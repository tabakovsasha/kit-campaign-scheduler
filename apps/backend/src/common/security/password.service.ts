import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, PasswordService.SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
