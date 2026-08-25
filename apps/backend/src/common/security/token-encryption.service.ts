import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

export type EncryptedTokenPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.TOKEN_ENCRYPTION_KEY ?? '';
    if (!rawKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY is not set');
    }

    this.key = createHash('sha256').update(rawKey, 'utf8').digest();
  }

  encrypt(plain: string): EncryptedTokenPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(payload: EncryptedTokenPayload): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
