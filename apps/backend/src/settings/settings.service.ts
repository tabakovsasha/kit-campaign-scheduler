import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IntegrationVerifyStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { TokenEncryptionService } from '../common/security/token-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  VoximplantApiError,
  VoximplantApiService,
} from '../voximplant/voximplant-api.service';
import {
  INTEGRATION_AUTH_FAILED_CODE,
  INTEGRATION_NOT_CONFIGURED_CODE,
  IntegrationAuthException,
  IntegrationNotConfiguredException,
} from './integration-auth.exception';

type DecryptedIntegration = {
  domain: string;
  host: string;
  accessToken: string;
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly runtimeVerificationCache = new Map<string, number>();
  private readonly runtimeVerificationTtlMs = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly voximplantApi: VoximplantApiService,
  ) {}

  async getByUserId(userId: string) {
    const settings = await this.prisma.integrationSettings.findUnique({
      where: { userId },
      select: {
        id: true,
        domain: true,
        host: true,
        tokenLast4: true,
        verifyStatus: true,
        verifyMessage: true,
        verifiedAccountId: true,
        verifiedAccountName: true,
        verifiedRegions: true,
        lastVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return settings;
  }

  async upsertEncrypted(
    userId: string,
    payload: {
      domain: string;
      host: string;
      accessToken: string;
    },
  ) {
    const encrypted = this.tokenEncryption.encrypt(payload.accessToken);
    const tokenLast4 = payload.accessToken.slice(-4);

    return this.prisma.integrationSettings.upsert({
      where: { userId },
      create: {
        userId,
        domain: payload.domain,
        host: payload.host,
        accessTokenEncrypted: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        tokenLast4,
        verifyStatus: IntegrationVerifyStatus.unverified,
      },
      update: {
        domain: payload.domain,
        host: payload.host,
        accessTokenEncrypted: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        tokenLast4,
        verifyStatus: IntegrationVerifyStatus.unverified,
        verifyMessage: null,
        lastVerifiedAt: null,
      },
      select: {
        id: true,
        domain: true,
        host: true,
        tokenLast4: true,
        verifyStatus: true,
        updatedAt: true,
      },
    });
  }

  async getDecryptedByUserId(userId: string): Promise<DecryptedIntegration | null> {
    const settings = await this.prisma.integrationSettings.findUnique({
      where: { userId },
      select: {
        domain: true,
        host: true,
        accessTokenEncrypted: true,
        accessTokenIv: true,
        accessTokenAuthTag: true,
      },
    });

    if (!settings) {
      return null;
    }

    const accessToken = this.tokenEncryption.decrypt({
      ciphertext: settings.accessTokenEncrypted,
      iv: settings.accessTokenIv,
      authTag: settings.accessTokenAuthTag,
    });

    return {
      domain: settings.domain,
      host: settings.host,
      accessToken,
    };
  }

  async ensureRuntimeVerifiedCredentials(userId: string): Promise<DecryptedIntegration> {
    const now = Date.now();
    const cachedUntil = this.runtimeVerificationCache.get(userId);

    const credentials = await this.getDecryptedByUserId(userId);
    if (!credentials) {
      throw new IntegrationNotConfiguredException();
    }

    if (cachedUntil && cachedUntil > now) {
      return credentials;
    }

    const verification = await this.verifyCredentials(userId, credentials, 'runtime-guard');
    if (!verification.verified) {
      throw new IntegrationAuthException(verification.message, verification.details);
    }

    this.runtimeVerificationCache.set(userId, now + this.runtimeVerificationTtlMs);
    return credentials;
  }

  async verifyAndPersist(userId: string) {
    const credentials = await this.getDecryptedByUserId(userId);
    if (!credentials) {
      return {
        verified: false,
        code: INTEGRATION_NOT_CONFIGURED_CODE,
        message: 'Integration settings not found',
      };
    }

    return this.verifyCredentials(userId, credentials, 'manual-verify');
  }

  private async verifyCredentials(
    userId: string,
    credentials: DecryptedIntegration,
    source: 'manual-verify' | 'runtime-guard',
  ): Promise<{
    verified: boolean;
    code?: string;
    message: string;
    details?: unknown;
    account?: {
      id: number | bigint | null;
      name: string | null;
      mediaserverRegions: Prisma.JsonValue;
    };
    settings?: {
      id: string;
      domain: string;
      host: string;
      tokenLast4: string | null;
      verifyStatus: IntegrationVerifyStatus;
      verifyMessage: string | null;
      verifiedAccountId: bigint | null;
      verifiedAccountName: string | null;
      verifiedRegions: Prisma.JsonValue;
      lastVerifiedAt: Date | null;
      updatedAt: Date;
    };
  }> {
    const requestId = randomUUID();

    try {
      const response = await this.voximplantApi.getAccountInfo({
        host: credentials.host,
        domain: credentials.domain,
        accessToken: credentials.accessToken,
      });

      const account = response.result?.domain;
      const regions =
        account?.partner?.media_servers_regions ?? account?.media_servers_regions ?? null;

      const isSuccess = Boolean(response.success && account?.id && account?.name);

      if (!isSuccess) {
        const message = 'Verification failed: unexpected API response';
        await this.markVerificationFailed(userId, message);
        this.runtimeVerificationCache.delete(userId);
        this.logger.warn(
          JSON.stringify({
            event: 'integration.verify.failed',
            source,
            userId,
            requestId,
            reason: message,
          }),
        );

        return {
          verified: false,
          code: INTEGRATION_AUTH_FAILED_CODE,
          message,
        };
      }

      const updated = await this.prisma.integrationSettings.update({
        where: { userId },
        data: {
          verifyStatus: IntegrationVerifyStatus.success,
          verifyMessage: 'successful authorization',
          verifiedAccountId: account?.id,
          verifiedAccountName: account?.name,
          verifiedRegions: regions ?? Prisma.JsonNull,
          lastVerifiedAt: new Date(),
        },
        select: {
          id: true,
          domain: true,
          host: true,
          tokenLast4: true,
          verifyStatus: true,
          verifyMessage: true,
          verifiedAccountId: true,
          verifiedAccountName: true,
          verifiedRegions: true,
          lastVerifiedAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'integration.verify.success',
          source,
          userId,
          requestId,
          verifyStatus: updated.verifyStatus,
        }),
      );

      return {
        verified: true,
        code: 'INTEGRATION_OK',
        message: 'successful authorization',
        account: {
          id: updated.verifiedAccountId,
          name: updated.verifiedAccountName,
          mediaserverRegions: updated.verifiedRegions,
        },
        settings: updated,
      };
    } catch (error) {
      const details = this.toErrorDetails(error);
      const message = this.toVerificationFailureMessage(error);
      await this.markVerificationFailed(userId, message);
      this.runtimeVerificationCache.delete(userId);
      this.logger.warn(
        JSON.stringify({
          event: 'integration.verify.failed',
          source,
          userId,
          requestId,
          reason: message,
          details,
        }),
      );

      return {
        verified: false,
        code: INTEGRATION_AUTH_FAILED_CODE,
        message,
        details,
      };
    }
  }

  private async markVerificationFailed(userId: string, message: string) {
    await this.prisma.integrationSettings.update({
      where: { userId },
      data: {
        verifyStatus: IntegrationVerifyStatus.failed,
        verifyMessage: message,
        lastVerifiedAt: new Date(),
      },
    });
  }

  private toVerificationFailureMessage(error: unknown): string {
    if (error instanceof VoximplantApiError) {
      if (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 422) {
        return 'Verification failed: invalid or expired Voximplant token';
      }

      return `Verification failed: Voximplant API status ${error.statusCode}`;
    }

    return 'Verification failed: API request error';
  }

  private toErrorDetails(error: unknown): unknown {
    if (error instanceof VoximplantApiError) {
      return {
        statusCode: error.statusCode,
        responseBody: error.responseBody,
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return error;
  }
}
