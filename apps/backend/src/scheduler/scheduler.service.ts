import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly tickIntervalMs = 10_000;

  constructor(private readonly schedulesService: SchedulesService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);

    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.schedulesService.purgeDeletedSchedules();
      await this.schedulesService.processEnabledSchedules();
    } catch (error) {
      this.logger.error('Scheduler tick failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
