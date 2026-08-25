import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => this.serialize(value)));
  }

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item));
    }

    if (value instanceof Date || value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.serialize(item),
        ]),
      );
    }

    return value;
  }
}
