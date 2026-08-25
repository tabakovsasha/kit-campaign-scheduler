import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from './allow-password-change-required.decorator';
import { AuthService } from './auth.service';
import { JwtUserPayload } from './auth.types';
import { PasswordChangeRequiredException } from './password-change-required.exception';

export type AuthenticatedRequest = Request & {
  user?: JwtUserPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = await this.authService.verifyAccessToken(token);

    const user = await this.authService.getUserAccessState(payload.sub);
    if (!user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    const allowPasswordChangeRequired = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user.mustChangePassword && !allowPasswordChangeRequired) {
      throw new PasswordChangeRequiredException();
    }

    request.user = {
      ...payload,
      mustChangePassword: user.mustChangePassword,
    };
    return true;
  }
}
