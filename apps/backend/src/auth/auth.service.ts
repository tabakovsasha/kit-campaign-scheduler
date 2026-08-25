import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { PasswordPolicyService } from '../common/security/password-policy.service';
import { PasswordService } from '../common/security/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from './auth.types';

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    login: string;
    mustChangePassword: boolean;
  };
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtlDays: number;
  private readonly allowPublicRegistration: boolean;
  private readonly loginRateLimitWindowMs = 60_000;
  private readonly loginRateLimitMax = 10;
  private readonly refreshRateLimitWindowMs = 60_000;
  private readonly refreshRateLimitMax = 20;
  private readonly accountLockThreshold = 5;
  private readonly accountLockMs = 15 * 60 * 1000;
  private readonly loginRateLimitBuckets = new Map<string, RateLimitBucket>();
  private readonly refreshRateLimitBuckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly passwordService: PasswordService,
  ) {
    this.accessSecret = process.env.JWT_ACCESS_SECRET ?? '';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
    this.accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
    this.refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '7');
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const allowPublicRegistration = process.env.AUTH_ALLOW_PUBLIC_REGISTRATION ??
      (nodeEnv === 'production' ? 'false' : 'true');
    this.allowPublicRegistration = allowPublicRegistration === 'true';

    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
    }

    if (
      nodeEnv === 'production' &&
      (this.accessSecret === 'dev-access-secret' || this.refreshSecret === 'dev-refresh-secret')
    ) {
      throw new Error('Insecure JWT defaults are forbidden in production');
    }
  }

  async onModuleInit(): Promise<void> {
    const bootLogin = process.env.BOOT_USER_LOGIN;
    const bootPassword = process.env.BOOT_USER_PASSWORD;

    if (!bootLogin || !bootPassword) {
      return;
    }

    const existing = await this.prisma.user.findUnique({ where: { login: bootLogin } });
    if (existing) {
      const matchesDefault = await this.passwordService.compare(
        bootPassword,
        existing.passwordHash,
      );
      if (matchesDefault && !existing.mustChangePassword) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            mustChangePassword: true,
          },
        });
      }
      return;
    }

    const passwordHash = await this.passwordService.hash(bootPassword);
    await this.prisma.user.create({
      data: {
        login: bootLogin,
        passwordHash,
        mustChangePassword: true,
      },
    });
  }

  async login(login: string, password: string, ip?: string, userAgent?: string): Promise<LoginResult> {
    this.assertNotRateLimited(this.loginRateLimitBuckets, this.toLoginRateKey(login, ip), {
      max: this.loginRateLimitMax,
      windowMs: this.loginRateLimitWindowMs,
    });

    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user || !user.isActive) {
      this.markRateLimitFailure(this.loginRateLimitBuckets, this.toLoginRateKey(login, ip), {
        windowMs: this.loginRateLimitWindowMs,
      });
      throw new UnauthorizedException('Invalid login or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      this.markRateLimitFailure(this.loginRateLimitBuckets, this.toLoginRateKey(login, ip), {
        windowMs: this.loginRateLimitWindowMs,
      });
      throw new UnauthorizedException('Invalid login or password');
    }

    const isValidPassword = await this.passwordService.compare(password, user.passwordHash);
    if (!isValidPassword) {
      await this.registerFailedLogin(user.id, user.failedLoginAttempts);
      this.markRateLimitFailure(this.loginRateLimitBuckets, this.toLoginRateKey(login, ip), {
        windowMs: this.loginRateLimitWindowMs,
      });
      throw new UnauthorizedException('Invalid login or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    this.clearRateLimit(this.loginRateLimitBuckets, this.toLoginRateKey(login, ip));

    return this.issueTokensForUser(user.id, user.login, user.mustChangePassword, ip, userAgent);
  }

  async refresh(refreshToken: string, ip?: string): Promise<LoginResult> {
    this.assertNotRateLimited(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip), {
      max: this.refreshRateLimitMax,
      windowMs: this.refreshRateLimitWindowMs,
    });

    let payload: JwtUserPayload;

    try {
      payload = verify(refreshToken, this.refreshSecret) as JwtUserPayload;
    } catch {
      this.markRateLimitFailure(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip), {
        windowMs: this.refreshRateLimitWindowMs,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || !session.user.isActive) {
      this.markRateLimitFailure(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip), {
        windowMs: this.refreshRateLimitWindowMs,
      });
      throw new UnauthorizedException('Session is not active');
    }

    const hashedProvidedToken = this.hashToken(refreshToken);
    if (session.refreshTokenHash !== hashedProvidedToken) {
      this.markRateLimitFailure(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip), {
        windowMs: this.refreshRateLimitWindowMs,
      });
      throw new UnauthorizedException('Refresh token mismatch');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.markRateLimitFailure(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip), {
        windowMs: this.refreshRateLimitWindowMs,
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    this.clearRateLimit(this.refreshRateLimitBuckets, this.toRefreshRateKey(ip));

    return this.issueTokensForUser(
      session.user.id,
      session.user.login,
      session.user.mustChangePassword,
      session.ip ?? undefined,
      session.userAgent ?? undefined,
    );
  }

  async getMe(userId: string): Promise<{ id: string; login: string; mustChangePassword: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, login: true, isActive: true, mustChangePassword: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    return {
      id: user.id,
      login: user.login,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    const currentMatches = await this.passwordService.compare(currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new UnauthorizedException('Invalid login or password');
    }

    const newMatchesCurrent = await this.passwordService.compare(newPassword, user.passwordHash);
    if (newMatchesCurrent) {
      throw new BadRequestException('New password must be different from current password');
    }

    const policy = this.passwordPolicy.validate(newPassword, user.login);
    if (!policy.valid) {
      throw new BadRequestException(policy.reason ?? 'Password policy violation');
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      reloginRequired: true,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async verifyAccessToken(token: string): Promise<JwtUserPayload> {
    try {
      return verify(token, this.accessSecret) as JwtUserPayload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async register(login: string, password: string): Promise<{ id: string; login: string }> {
    if (!this.allowPublicRegistration) {
      throw new ForbiddenException('Public registration is disabled');
    }

    const existing = await this.prisma.user.findUnique({ where: { login } });
    if (existing) {
      throw new ConflictException('Login already exists');
    }

    const policy = this.passwordPolicy.validate(password, login);
    if (!policy.valid) {
      throw new BadRequestException(policy.reason ?? 'Password policy violation');
    }

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.prisma.user.create({
      data: {
        login,
        passwordHash,
      },
      select: {
        id: true,
        login: true,
      },
    });

    return user;
  }

  private async issueTokensForUser(
    userId: string,
    login: string,
    mustChangePassword: boolean,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const sessionId = randomUUID();
    const jti = randomUUID();

    const payload: JwtUserPayload = {
      sub: userId,
      login,
      sessionId,
      jti,
      mustChangePassword,
    };

    const accessToken = sign(payload as object, this.accessSecret, {
      expiresIn: this.accessTtl,
    } as any);

    const refreshToken = sign(payload as object, this.refreshSecret, {
      expiresIn: `${this.refreshTtlDays}d`,
    } as any);

    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        jti,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
        ip,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        login,
        mustChangePassword,
      },
    };
  }

  async getUserAccessState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User is not active');
    }

    return user;
  }

  private async registerFailedLogin(userId: string, failedAttempts: number) {
    const nextAttempts = failedAttempts + 1;
    const shouldLock = nextAttempts >= this.accountLockThreshold;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + this.accountLockMs) : null,
      },
    });
  }

  private toLoginRateKey(login: string, ip?: string): string {
    return `${login.toLowerCase()}:${ip ?? 'unknown'}`;
  }

  private toRefreshRateKey(ip?: string): string {
    return ip ?? 'unknown';
  }

  private assertNotRateLimited(
    storage: Map<string, RateLimitBucket>,
    key: string,
    options: { max: number; windowMs: number },
  ) {
    const bucket = storage.get(key);
    const now = Date.now();
    if (!bucket) {
      return;
    }

    if (bucket.resetAt <= now) {
      storage.delete(key);
      return;
    }

    if (bucket.count >= options.max) {
      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many auth attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private markRateLimitFailure(
    storage: Map<string, RateLimitBucket>,
    key: string,
    options: { windowMs: number },
  ) {
    const now = Date.now();
    const existing = storage.get(key);

    if (!existing || existing.resetAt <= now) {
      storage.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return;
    }

    existing.count += 1;
  }

  private clearRateLimit(storage: Map<string, RateLimitBucket>, key: string) {
    storage.delete(key);
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
