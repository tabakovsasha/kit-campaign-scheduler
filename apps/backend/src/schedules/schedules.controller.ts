import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUserPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateScheduleDto,
  ToggleScheduleDto,
  UpdateScheduleDto,
} from './dto/create-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('campaigns/search')
  searchCampaigns(
    @CurrentUser() user: JwtUserPayload,
    @Query('q') query?: string,
  ) {
    return this.schedulesService.searchCampaigns(user.sub, query);
  }

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.schedulesService.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtUserPayload, @Body() body: CreateScheduleDto) {
    return this.schedulesService.create(user.sub, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.schedulesService.updateWithTimezoneAudit(user.sub, id, body);
  }

  @Patch(':id/toggle')
  toggle(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: ToggleScheduleDto,
  ) {
    return this.schedulesService.toggle(user.sub, id, body.enabled);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.schedulesService.softDelete(user.sub, id);
  }

  @Patch(':id/restore')
  restore(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.schedulesService.restore(user.sub, id);
  }
}
