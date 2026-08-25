import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class IsoConsoleLogger extends ConsoleLogger {
  protected getTimestamp(): string {
    return new Date().toISOString();
  }
}
