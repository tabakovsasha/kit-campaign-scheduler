import { Global, Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordService } from './password.service';
import { TokenEncryptionService } from './token-encryption.service';

@Global()
@Module({
  providers: [PasswordService, PasswordPolicyService, TokenEncryptionService],
  exports: [PasswordService, PasswordPolicyService, TokenEncryptionService],
})
export class SecurityModule {}
