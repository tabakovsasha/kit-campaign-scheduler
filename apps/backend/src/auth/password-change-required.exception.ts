import { HttpException, HttpStatus } from '@nestjs/common';

export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

export class PasswordChangeRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: PASSWORD_CHANGE_REQUIRED_CODE,
        message: 'Password change is required before accessing this endpoint',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
