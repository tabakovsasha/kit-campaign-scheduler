import { HttpException, HttpStatus } from '@nestjs/common';

export const INTEGRATION_AUTH_FAILED_CODE = 'INTEGRATION_AUTH_FAILED';
export const INTEGRATION_NOT_CONFIGURED_CODE = 'INTEGRATION_NOT_CONFIGURED';

export class IntegrationAuthException extends HttpException {
  constructor(message: string, details?: unknown) {
    super(
      {
        code: INTEGRATION_AUTH_FAILED_CODE,
        message,
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class IntegrationNotConfiguredException extends HttpException {
  constructor(message = 'Integration settings not configured') {
    super(
      {
        code: INTEGRATION_NOT_CONFIGURED_CODE,
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
