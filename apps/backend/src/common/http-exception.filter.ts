import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestWithId } from './request-id.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as Record<string, unknown>;
      if (typeof payload.code === 'string') {
        code = payload.code;
      }
      if (typeof payload.message === 'string') {
        message = payload.message;
      }
      if (payload.details !== undefined) {
        details = payload.details;
      }
    }

    if (exception instanceof HttpException && code === 'INTERNAL_ERROR') {
      code = `HTTP_${status}`;
    }

    const requestId = request.requestId ?? null;

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'http.error',
          requestId,
          method: request.method,
          path: request.originalUrl,
          status,
          code,
          message,
        }),
      );
    }

    response.status(status).json({
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
