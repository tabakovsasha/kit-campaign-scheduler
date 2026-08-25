import { Module } from '@nestjs/common';
import { SchedulesModule } from '../schedules/schedules.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [SchedulesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
