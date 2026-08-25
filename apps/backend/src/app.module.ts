import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SecurityModule } from './common/security/security.module';
import { HealthModule } from './health/health.module';
import { LogsModule } from './logs/logs.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SettingsModule } from './settings/settings.module';
import { VoximplantModule } from './voximplant/voximplant.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    VoximplantModule,
    HealthModule,
    AuthModule,
    SettingsModule,
    SchedulesModule,
    SchedulerModule,
    LogsModule,
  ],
})
export class AppModule {}
