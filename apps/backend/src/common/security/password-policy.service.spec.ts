import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const service = new PasswordPolicyService();

  it('rejects weak and common passwords', () => {
    const result = service.validate('admin123', 'admin');
    expect(result.valid).toBe(false);
  });

  it('accepts strong password', () => {
    const result = service.validate('Secur3!Passw0rd', 'admin');
    expect(result.valid).toBe(true);
  });

  it('rejects password containing login', () => {
    const result = service.validate('AdminUser!234', 'adminuser');
    expect(result.valid).toBe(false);
  });
});
