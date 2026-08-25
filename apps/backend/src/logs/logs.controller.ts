import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUserPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogsService } from './logs.service';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('schedule/:scheduleId')
  bySchedule(
    @CurrentUser() user: JwtUserPayload,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.logsService.bySchedule(user.sub, scheduleId);
  }
}
