import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordPolicyService {
  private readonly minLength = 10;
  private readonly deniedPasswords = new Set([
    'admin123',
    'password',
    'password123',
    'qwerty',
    'qwerty123',
    '123456',
    '12345678',
  ]);

  validate(password: string, login?: string): { valid: boolean; reason?: string } {
    if (password.length < this.minLength) {
      return { valid: false, reason: `Password must be at least ${this.minLength} characters` };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, reason: 'Password must contain a lowercase letter' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, reason: 'Password must contain an uppercase letter' };
    }

    if (!/\d/.test(password)) {
      return { valid: false, reason: 'Password must contain a digit' };
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return { valid: false, reason: 'Password must contain a special character' };
    }

    const normalized = password.toLowerCase();
    if (this.deniedPasswords.has(normalized)) {
      return { valid: false, reason: 'Password is too common' };
    }

    if (login && normalized.includes(login.toLowerCase())) {
      return { valid: false, reason: 'Password must not include login' };
    }

    return { valid: true };
  }
}
