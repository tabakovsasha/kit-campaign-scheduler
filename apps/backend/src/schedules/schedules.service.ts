import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  LogAction,
  LogSource,
  LogStatus,
  Prisma,
  RuntimeState,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationAuthException } from '../settings/integration-auth.exception';
import {
  VoximplantApiError,
  VoximplantApiService,
} from '../voximplant/voximplant-api.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/create-schedule.dto';
import { ALL_CAMPAIGN_STATUSES } from '../voximplant/voximplant.types';

type DesiredState = 'paused' | 'resumed';

type CampaignActualStatus = 'draft' | 'scheduled' | 'paused' | 'ongoing' | 'completed';

type CampaignStatusCacheEntry = {
  expiresAt: number;
  statuses: Map<string, CampaignActualStatus>;
};

type ScheduleWithRelations = Prisma.ScheduleGetPayload<{
  include: {
    weekdays: true;
    workIntervals: true;
    breakIntervals: true;
    exceptions: true;
    runtimeState: true;
  };
}>;

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const TIME_24H_COLON_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

@Injectable()
export class SchedulesService {
  private readonly campaignStatusCache = new Map<string, CampaignStatusCacheEntry>();
  private readonly campaignStatusCacheTtlMs = 30_000;
  private readonly deleteRetentionMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly voximplantApi: VoximplantApiService,
  ) {}

  async searchCampaigns(userId: string, query?: string) {
    const integration = await this.settingsService.ensureRuntimeVerifiedCredentials(userId);

    let response;
    try {
      response = await this.voximplantApi.searchCampaigns({
        host: integration.host,
        domain: integration.domain,
        accessToken: integration.accessToken,
      });
    } catch (error) {
      if (error instanceof VoximplantApiError) {
        await this.settingsService.verifyAndPersist(userId);
        throw new IntegrationAuthException(
          'Campaign loading failed due to Voximplant authorization issue',
          {
            statusCode: error.statusCode,
            responseBody: error.responseBody,
          },
        );
      }

      throw error;
    }

    const items = (response.result ?? []).map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
    }));

    const normalizedQuery = (query ?? '').trim().toLowerCase();
    const filtered = normalizedQuery
      ? items.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      : items;

    return filtered;
  }

  async list(userId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { userId },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const campaignStatuses = await this.getCampaignActualStatuses(userId);
    const now = new Date();

    return schedules
      .map((schedule) => ({
        ...this.toScheduleResponse(schedule, now),
        campaign_actual_status:
          campaignStatuses.get(schedule.campaignId.toString()) ?? null,
      }))
      .sort((left, right) => {
        if (left.isDeleted !== right.isDeleted) {
          return left.isDeleted ? 1 : -1;
        }

        if (!left.isDeleted) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }

        const leftPurgeAt = left.purgeAt ? new Date(left.purgeAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightPurgeAt = right.purgeAt
          ? new Date(right.purgeAt).getTime()
          : Number.MAX_SAFE_INTEGER;

        return leftPurgeAt - rightPurgeAt;
      });
  }

  async create(userId: string, dto: CreateScheduleDto) {
    this.validateIntervals(dto.workIntervals, 'workIntervals');
    this.validateIntervals(dto.breakIntervals ?? [], 'breakIntervals');
    this.validateDateRange(dto.startDate, dto.endDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.create({
        data: {
          userId,
          name: dto.name,
          campaignId: BigInt(dto.campaignId),
          campaignTitle: dto.campaignTitle,
          campaignTimezone: dto.campaignTimezone ?? 'Europe/Moscow',
          isEnabled: dto.isEnabled ?? true,
          startDate: dto.startDate ? this.toUtcDateOnly(dto.startDate) : null,
          endDate: dto.endDate ? this.toUtcDateOnly(dto.endDate) : null,
          notes: dto.notes ?? null,
        },
      });

      await this.replaceScheduleRelations(tx, schedule.id, dto);

      await tx.scheduleRuntimeState.create({
        data: {
          scheduleId: schedule.id,
          currentState: RuntimeState.unknown,
          lastCheckAt: new Date(),
        },
      });

      return tx.schedule.findUniqueOrThrow({
        where: { id: schedule.id },
        include: {
          weekdays: true,
          workIntervals: true,
          breakIntervals: true,
          exceptions: true,
          runtimeState: true,
        },
      });
    });

    if (created.isEnabled) {
      await this.processScheduleById(created.id, 'system', false);
    }

    return this.toScheduleResponse(created);
  }

  async update(userId: string, scheduleId: string, dto: UpdateScheduleDto) {
    return this.updateWithTimezoneAudit(userId, scheduleId, dto);
  }

  async updateWithTimezoneAudit(userId: string, scheduleId: string, dto: UpdateScheduleDto) {
    this.validateIntervals(dto.workIntervals, 'workIntervals');
    this.validateIntervals(dto.breakIntervals ?? [], 'breakIntervals');
    this.validateDateRange(dto.startDate, dto.endDate);

    const existing = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    if (existing.isDeleted) {
      throw new BadRequestException('Deleted schedule cannot be edited');
    }

    const oldTimezone = existing.campaignTimezone || 'Europe/Moscow';
    const newTimezone = dto.campaignTimezone ?? 'Europe/Moscow';
    const timezoneChanged = oldTimezone !== newTimezone;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          name: dto.name,
          campaignId: BigInt(dto.campaignId),
          campaignTitle: dto.campaignTitle,
          campaignTimezone: dto.campaignTimezone ?? 'Europe/Moscow',
          startDate: dto.startDate ? this.toUtcDateOnly(dto.startDate) : null,
          endDate: dto.endDate ? this.toUtcDateOnly(dto.endDate) : null,
          notes: dto.notes ?? null,
        },
      });

      await this.clearScheduleRelations(tx, scheduleId);
      await this.replaceScheduleRelations(tx, scheduleId, dto);

      return tx.schedule.findUniqueOrThrow({
        where: { id: scheduleId },
        include: {
          weekdays: true,
          workIntervals: true,
          breakIntervals: true,
          exceptions: true,
          runtimeState: true,
        },
      });
    });

    const resyncResult = updated.isEnabled
      ? await this.processScheduleById(updated.id, 'system', false)
      : {
          changed: false,
          state: updated.runtimeState?.currentState ?? RuntimeState.unknown,
          reason: 'schedule updated while disabled',
        };

    await this.writeActionLog({
      schedule: updated,
      source: 'manual',
      action: LogAction.edit_schedule,
      status: LogStatus.success,
      responsePayload: {
        editorUserId: userId,
        editedAt: new Date().toISOString(),
        message: 'schedule updated successfully',
        schedulerResynced: updated.isEnabled,
        resyncResult,
      },
    });

    if (timezoneChanged) {
      await this.writeActionLog({
        schedule: updated,
        source: 'manual',
        action: LogAction.edit_schedule,
        status: LogStatus.success,
        responsePayload: {
          editorUserId: userId,
          timezoneChangedAt: new Date().toISOString(),
          oldTimezone,
          newTimezone,
          message: `Часовой пояс изменен: ${oldTimezone} -> ${newTimezone}`,
        },
      });
    }

    const refreshed = await this.getScheduleWithRelations(updated.id);

    return {
      schedule: this.toScheduleResponse(refreshed),
      scheduler: {
        resynced: updated.isEnabled,
        result: resyncResult,
      },
    };
  }

  async toggle(userId: string, scheduleId: string, enabled?: boolean) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.isDeleted) {
      throw new BadRequestException('Deleted schedule cannot be toggled');
    }

    const newEnabled = enabled ?? !schedule.isEnabled;

    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        isEnabled: newEnabled,
      },
    });

    const updated = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    await this.writeActionLog({
      schedule: updated,
      source: 'manual',
      action: newEnabled ? LogAction.activate_schedule : LogAction.deactivate_schedule,
      status: LogStatus.success,
      responsePayload: {
        toggledByUserId: userId,
        toggledAt: new Date().toISOString(),
        isEnabled: newEnabled,
        message: newEnabled
          ? 'Расписание активировано вручную'
          : 'Расписание деактивировано вручную',
      },
    });

    return {
      schedule: this.toScheduleResponse(updated),
    };
  }

  async processEnabledSchedules() {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        isEnabled: true,
        isDeleted: false,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    let processed = 0;

    for (const schedule of schedules) {
      try {
        await this.processScheduleById(schedule.id, 'scheduler', false);
        processed += 1;
      } catch {
        await this.prisma.scheduleRuntimeState.upsert({
          where: { scheduleId: schedule.id },
          create: {
            scheduleId: schedule.id,
            currentState: schedule.runtimeState?.currentState ?? RuntimeState.unknown,
            lastDecisionReason: 'scheduler tick error',
            lastCheckAt: new Date(),
          },
          update: {
            lastDecisionReason: 'scheduler tick error',
            lastCheckAt: new Date(),
          },
        });
      }
    }

    return { processed };
  }

  async softDelete(userId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.isDeleted) {
      throw new BadRequestException('Schedule is already deleted');
    }

    const deletedAt = new Date();
    const purgeAt = new Date(deletedAt.getTime() + this.deleteRetentionMs);

    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        isDeleted: true,
        deletedAt,
        purgeAt,
        isEnabled: false,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    await this.writeActionLog({
      schedule: updated,
      source: 'manual',
      action: 'delete_schedule' as LogAction,
      status: LogStatus.success,
      responsePayload: {
        deletedByUserId: userId,
        deletedAt: deletedAt.toISOString(),
        purgeAt: purgeAt.toISOString(),
        message: 'Расписание удалено в корзину на 24 часа',
      },
    });

    return {
      schedule: this.toScheduleResponse(updated),
    };
  }

  async restore(userId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (!schedule.isDeleted) {
      throw new BadRequestException('Schedule is not deleted');
    }

    if (!schedule.purgeAt || schedule.purgeAt.getTime() <= Date.now()) {
      throw new BadRequestException('Restore period expired');
    }

    const restoredAt = new Date();

    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        isDeleted: false,
        deletedAt: null,
        purgeAt: null,
        isEnabled: true,
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    const resyncResult = await this.processScheduleById(updated.id, 'system', false);

    await this.writeActionLog({
      schedule: updated,
      source: 'manual',
      action: 'restore_schedule' as LogAction,
      status: LogStatus.success,
      responsePayload: {
        restoredByUserId: userId,
        restoredAt: restoredAt.toISOString(),
        message: 'Расписание восстановлено из корзины',
        schedulerResync: resyncResult,
      },
    });

    return {
      schedule: this.toScheduleResponse(updated),
    };
  }

  async purgeDeletedSchedules() {
    const now = new Date();
    const schedules = await this.prisma.schedule.findMany({
      where: {
        isDeleted: true,
        purgeAt: {
          lte: now,
        },
      },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    let purged = 0;

    for (const schedule of schedules) {
      try {
        await this.writeActionLog({
          schedule,
          source: 'scheduler',
          action: 'auto_delete_schedule' as LogAction,
          status: LogStatus.success,
          responsePayload: {
            deletedAt: schedule.deletedAt?.toISOString() ?? null,
            purgeAt: schedule.purgeAt?.toISOString() ?? null,
            purgedAt: now.toISOString(),
            message: 'Расписание автоматически удалено после 24 часов в корзине',
          },
        });

        await this.prisma.schedule.delete({
          where: { id: schedule.id },
        });

        purged += 1;
      } catch (error) {
        await this.writeActionLog({
          schedule,
          source: 'scheduler',
          action: 'auto_delete_schedule' as LogAction,
          status: LogStatus.error,
          errorMessage:
            error instanceof Error ? error.message : 'Automatic schedule purge failed',
          responsePayload: {
            deletedAt: schedule.deletedAt?.toISOString() ?? null,
            purgeAt: schedule.purgeAt?.toISOString() ?? null,
            attemptedAt: now.toISOString(),
          },
        });
      }
    }

    return { purged };
  }

  async processScheduleById(
    scheduleId: string,
    source: 'scheduler' | 'manual' | 'system',
    throwOnError: boolean,
    forcedDesiredState?: DesiredState,
  ) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.isDeleted) {
      return {
        changed: false,
        state: schedule.runtimeState?.currentState ?? RuntimeState.unknown,
        reason: 'schedule deleted pending purge',
      };
    }

    const evaluated = forcedDesiredState
      ? { desiredState: forcedDesiredState, reason: 'manual toggle' }
      : this.evaluateDesiredState(schedule);

    return this.applyDesiredState(
      schedule,
      evaluated.desiredState,
      evaluated.reason,
      source,
      throwOnError,
    );
  }

  private async applyDesiredState(
    schedule: ScheduleWithRelations,
    desiredState: DesiredState,
    reason: string,
    source: 'scheduler' | 'manual' | 'system',
    throwOnError: boolean,
  ) {
    const runtimeState = schedule.runtimeState?.currentState ?? RuntimeState.unknown;

    if (schedule.isDeleted) {
      return {
        changed: false,
        state: runtimeState,
        reason: 'schedule deleted pending purge',
      };
    }

    if (runtimeState === desiredState) {
      await this.prisma.scheduleRuntimeState.upsert({
        where: { scheduleId: schedule.id },
        create: {
          scheduleId: schedule.id,
          currentState: desiredState,
          lastDecisionReason: reason,
          lastCheckAt: new Date(),
          lastTransitionAt: new Date(),
        },
        update: {
          lastDecisionReason: reason,
          lastCheckAt: new Date(),
        },
      });

      return {
        changed: false,
        state: desiredState,
        reason,
      };
    }

    let integration;
    try {
      integration = await this.settingsService.ensureRuntimeVerifiedCredentials(schedule.userId);
    } catch {
      integration = null;
    }
    if (!integration) {
      const message = 'Integration runtime verification failed';

      await this.writeActionLog({
        schedule,
        source,
        action: desiredState === 'resumed' ? LogAction.resume : LogAction.pause,
        status: LogStatus.error,
        errorMessage: message,
      });

      if (throwOnError) {
        throw new NotFoundException(message);
      }

      return {
        changed: false,
        state: runtimeState,
        reason: message,
      };
    }

    try {
      const response =
        desiredState === 'resumed'
          ? await this.voximplantApi.resumeCampaign(
              {
                host: integration.host,
                domain: integration.domain,
                accessToken: integration.accessToken,
              },
              Number(schedule.campaignId),
            )
          : await this.voximplantApi.pauseCampaign(
              {
                host: integration.host,
                domain: integration.domain,
                accessToken: integration.accessToken,
              },
              Number(schedule.campaignId),
            );

      await this.prisma.scheduleRuntimeState.upsert({
        where: { scheduleId: schedule.id },
        create: {
          scheduleId: schedule.id,
          currentState: desiredState,
          lastDecisionReason: reason,
          lastTransitionAt: new Date(),
          lastCheckAt: new Date(),
        },
        update: {
          currentState: desiredState,
          lastDecisionReason: reason,
          lastTransitionAt: new Date(),
          lastCheckAt: new Date(),
        },
      });

      await this.writeActionLog({
        schedule,
        source,
        action: desiredState === 'resumed' ? LogAction.resume : LogAction.pause,
        status: LogStatus.success,
        responsePayload: response,
      });

      return {
        changed: true,
        state: desiredState,
        reason,
      };
    } catch (error) {
      if (error instanceof VoximplantApiError && error.statusCode === 422) {
        const reconciled = await this.reconcileCampaignStateFromRemote(
          schedule,
          desiredState,
          reason,
          source,
        );

        if (reconciled) {
          return reconciled;
        }
      }

      const message =
        error instanceof Error ? error.message : 'Voximplant action request failed';

      await this.prisma.scheduleRuntimeState.upsert({
        where: { scheduleId: schedule.id },
        create: {
          scheduleId: schedule.id,
          currentState: runtimeState,
          lastDecisionReason: `${reason}. error: ${message}`,
          lastCheckAt: new Date(),
        },
        update: {
          lastDecisionReason: `${reason}. error: ${message}`,
          lastCheckAt: new Date(),
        },
      });

      await this.writeActionLog({
        schedule,
        source,
        action: desiredState === 'resumed' ? LogAction.resume : LogAction.pause,
        status: LogStatus.error,
        errorMessage: message,
      });

      if (throwOnError) {
        throw new InternalServerErrorException(message);
      }

      return {
        changed: false,
        state: runtimeState,
        reason: message,
      };
    }
  }

  private evaluateDesiredState(
    schedule: ScheduleWithRelations,
  ): { desiredState: DesiredState; reason: string } {
    if (!schedule.isEnabled) {
      return { desiredState: 'paused', reason: 'schedule is disabled' };
    }

    const timezone = schedule.campaignTimezone || 'Europe/Moscow';
    const now = this.getZonedNow(timezone);

    if (schedule.startDate) {
      const startDateLocal = this.toDateKeyInTimezone(schedule.startDate, timezone);
      if (now.dateKey < startDateLocal) {
        return { desiredState: 'paused', reason: 'outside start date' };
      }
    }

    if (schedule.endDate) {
      const endDateLocal = this.toDateKeyInTimezone(schedule.endDate, timezone);
      if (now.dateKey > endDateLocal) {
        return { desiredState: 'paused', reason: 'outside end date' };
      }
    }

    const exception = schedule.exceptions.find((item) => {
      const startDateKey = this.toDateKeyInTimezone(item.startDate, timezone);
      const endDateKey = this.toDateKeyInTimezone(item.endDate, timezone);

      if (item.isRecurringYearly) {
        const startMonthDayKey = this.toMonthDayKeyInTimezone(item.startDate, timezone);
        const endMonthDayKey = this.toMonthDayKeyInTimezone(item.endDate, timezone);

        return this.isMonthDayInRange(
          now.monthDayKey,
          startMonthDayKey,
          endMonthDayKey,
        );
      }

      return now.dateKey >= startDateKey && now.dateKey <= endDateKey;
    });

    if (exception) {
      if (exception.type === 'day_off') {
        return { desiredState: 'paused', reason: 'day-off exception range' };
      }

      if (exception.customStartTime && exception.customEndTime) {
        const active = this.isTimeInsideRange(
          now.minutes,
          exception.customStartTime,
          exception.customEndTime,
        );

        return active
          ? { desiredState: 'resumed', reason: 'custom working-hours exception range' }
          : { desiredState: 'paused', reason: 'outside custom working-hours exception range' };
      }
    }

    const isWeekdayEnabled = schedule.weekdays.some(
      (weekday) => weekday.weekday === now.weekday && weekday.isActive,
    );

    if (!isWeekdayEnabled) {
      return { desiredState: 'paused', reason: 'weekday disabled' };
    }

    const workIntervals = schedule.workIntervals.filter(
      (interval) => interval.weekday === now.weekday,
    );

    if (workIntervals.length === 0) {
      return { desiredState: 'paused', reason: 'no work intervals for weekday' };
    }

    const inWorkTime = workIntervals.some((interval) =>
      this.isTimeInsideRange(now.minutes, interval.startTime, interval.endTime),
    );

    if (!inWorkTime) {
      return { desiredState: 'paused', reason: 'outside work intervals' };
    }

    const inBreakTime = schedule.breakIntervals
      .filter((interval) => interval.weekday === now.weekday)
      .some((interval) =>
        this.isTimeInsideRange(now.minutes, interval.startTime, interval.endTime),
      );

    if (inBreakTime) {
      return { desiredState: 'paused', reason: 'inside break interval' };
    }

    return { desiredState: 'resumed', reason: 'inside active schedule window' };
  }

  private async writeActionLog(params: {
    schedule: ScheduleWithRelations;
    source: 'scheduler' | 'manual' | 'system';
    action: LogAction;
    status: LogStatus;
    responsePayload?: unknown;
    errorMessage?: string;
  }) {
    await this.prisma.scheduleActionLog.create({
      data: {
        userId: params.schedule.userId,
        scheduleId: params.schedule.id,
        campaignId: params.schedule.campaignId,
        campaignTitle: params.schedule.campaignTitle,
        source: this.toLogSource(params.source),
        action: params.action,
        status: params.status,
        errorMessage: params.errorMessage,
        responsePayload:
          params.responsePayload && typeof params.responsePayload === 'object'
            ? (params.responsePayload as object)
            : undefined,
      },
    });
  }

  private async reconcileCampaignStateFromRemote(
    schedule: ScheduleWithRelations,
    desiredState: DesiredState,
    reason: string,
    source: 'scheduler' | 'manual' | 'system',
  ) {
    const integration = await this.settingsService.getDecryptedByUserId(schedule.userId);
    if (!integration) {
      return null;
    }

    const response = await this.voximplantApi.searchCampaigns({
      host: integration.host,
      domain: integration.domain,
      accessToken: integration.accessToken,
    });

    const remoteCampaign = (response.result ?? []).find(
      (item) => item.id === Number(schedule.campaignId),
    );

    if (!remoteCampaign) {
      return null;
    }

    const desiredReached =
      (desiredState === 'paused' && remoteCampaign.status === 'paused') ||
      (desiredState === 'resumed' &&
        (remoteCampaign.status === 'scheduled' || remoteCampaign.status === 'ongoing'));

    if (!desiredReached) {
      return null;
    }

    await this.prisma.scheduleRuntimeState.upsert({
      where: { scheduleId: schedule.id },
      create: {
        scheduleId: schedule.id,
        currentState: desiredState,
        lastDecisionReason: `${reason}. reconciled from remote status ${remoteCampaign.status}`,
        lastTransitionAt: new Date(),
        lastCheckAt: new Date(),
      },
      update: {
        currentState: desiredState,
        lastDecisionReason: `${reason}. reconciled from remote status ${remoteCampaign.status}`,
        lastTransitionAt: new Date(),
        lastCheckAt: new Date(),
      },
    });

    await this.writeActionLog({
      schedule,
      source,
      action: desiredState === 'resumed' ? LogAction.resume : LogAction.pause,
      status: LogStatus.success,
      responsePayload: {
        reconciled: true,
        remoteStatus: remoteCampaign.status,
        message: 'Desired campaign state was already applied on Voximplant side',
      },
    });

    return {
      changed: false,
      state: desiredState,
      reason: `reconciled from remote status ${remoteCampaign.status}`,
    };
  }

  private toLogSource(source: 'scheduler' | 'manual' | 'system'): LogSource {
    if (source === 'scheduler') {
      return LogSource.scheduler;
    }

    if (source === 'manual') {
      return LogSource.manual;
    }

    return LogSource.system;
  }

  private toScheduleResponse(
    schedule: ScheduleWithRelations,
    now = new Date(),
  ) {
    const remainingSeconds =
      schedule.isDeleted && schedule.purgeAt
        ? Math.max(0, Math.floor((schedule.purgeAt.getTime() - now.getTime()) / 1000))
        : null;

    return {
      id: schedule.id,
      name: schedule.name,
      campaignId: schedule.campaignId.toString(),
      campaignTitle: schedule.campaignTitle,
      campaignTimezone: schedule.campaignTimezone,
      isEnabled: schedule.isEnabled,
      isDeleted: schedule.isDeleted,
      deletedAt: schedule.deletedAt,
      purgeAt: schedule.purgeAt,
      remainingSeconds,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      notes: schedule.notes,
      weekdays: schedule.weekdays,
      workIntervals: schedule.workIntervals,
      breakIntervals: schedule.breakIntervals,
      exceptions: schedule.exceptions,
      runtimeState: schedule.runtimeState,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  private async getCampaignActualStatuses(
    userId: string,
  ): Promise<Map<string, CampaignActualStatus>> {
    const cached = this.campaignStatusCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.statuses;
    }

    const integration = await this.settingsService.ensureRuntimeVerifiedCredentials(userId);
    if (!integration) {
      return cached?.statuses ?? new Map();
    }

    try {
      const response = await this.voximplantApi.searchCampaignsWithStatuses(
        {
          host: integration.host,
          domain: integration.domain,
          accessToken: integration.accessToken,
        },
        ALL_CAMPAIGN_STATUSES,
      );

      const statuses = new Map(
        (response.result ?? []).map((campaign) => [
          String(campaign.id),
          campaign.status as CampaignActualStatus,
        ]),
      );

      this.campaignStatusCache.set(userId, {
        expiresAt: Date.now() + this.campaignStatusCacheTtlMs,
        statuses,
      });

      return statuses;
    } catch {
      return cached?.statuses ?? new Map();
    }
  }

  private getScheduleWithRelations(scheduleId: string): Promise<ScheduleWithRelations> {
    return this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: {
        weekdays: true,
        workIntervals: true,
        breakIntervals: true,
        exceptions: true,
        runtimeState: true,
      },
    });
  }

  private async clearScheduleRelations(
    tx: Prisma.TransactionClient,
    scheduleId: string,
  ) {
    await Promise.all([
      tx.scheduleWeekday.deleteMany({ where: { scheduleId } }),
      tx.scheduleWorkInterval.deleteMany({ where: { scheduleId } }),
      tx.scheduleBreakInterval.deleteMany({ where: { scheduleId } }),
      tx.scheduleException.deleteMany({ where: { scheduleId } }),
    ]);
  }

  private async replaceScheduleRelations(
    tx: Prisma.TransactionClient,
    scheduleId: string,
    dto: CreateScheduleDto | UpdateScheduleDto,
  ) {
    const uniqueWeekdays = [...new Set(dto.weekdays)];

    if (uniqueWeekdays.length > 0) {
      await tx.scheduleWeekday.createMany({
        data: uniqueWeekdays.map((weekday) => ({
          scheduleId,
          weekday,
          isActive: true,
        })),
      });
    }

    if (dto.workIntervals.length > 0) {
      await tx.scheduleWorkInterval.createMany({
        data: dto.workIntervals.map((interval) => ({
          scheduleId,
          weekday: interval.weekday,
          startTime: interval.startTime,
          endTime: interval.endTime,
        })),
      });
    }

    if ((dto.breakIntervals ?? []).length > 0) {
      await tx.scheduleBreakInterval.createMany({
        data: (dto.breakIntervals ?? []).map((interval) => ({
          scheduleId,
          weekday: interval.weekday,
          startTime: interval.startTime,
          endTime: interval.endTime,
          label: interval.label ?? null,
        })),
      });
    }

    if ((dto.exceptions ?? []).length > 0) {
      await tx.scheduleException.createMany({
        data: (dto.exceptions ?? []).map((exception) => ({
          scheduleId,
          startDate: this.toUtcDateOnly(exception.startDate),
          endDate: this.toUtcDateOnly(exception.endDate),
          type: exception.type,
          customStartTime: exception.customStartTime ?? null,
          customEndTime: exception.customEndTime ?? null,
          title: exception.title ?? null,
          isRecurringYearly: exception.isRecurringYearly ?? false,
        })),
      });
    }
  }

  private validateIntervals(
    intervals: Array<{ startTime: string; endTime: string }>,
    field: string,
  ) {
    for (const interval of intervals) {
      const start = this.toMinutes(interval.startTime);
      const end = this.toMinutes(interval.endTime);

      if (end <= start) {
        throw new InternalServerErrorException(
          `${field}: endTime must be greater than startTime`,
        );
      }
    }
  }

  private validateDateRange(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) {
      return;
    }

    if (endDate < startDate) {
      throw new InternalServerErrorException(
        'endDate must be greater than or equal to startDate',
      );
    }
  }

  private toUtcDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private getZonedNow(timezone: string): {
    dateKey: string;
    monthDayKey: string;
    weekday: number;
    minutes: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const year = this.getPart(parts, 'year');
    const month = this.getPart(parts, 'month');
    const day = this.getPart(parts, 'day');
    const hour = this.getPart(parts, 'hour');
    const minute = this.getPart(parts, 'minute');
    const weekdayLabel = this.getPart(parts, 'weekday');
    const weekday = WEEKDAY_MAP[weekdayLabel];

    return {
      dateKey: `${year}-${month}-${day}`,
      monthDayKey: `${month}-${day}`,
      weekday: weekday ?? 1,
      minutes: Number(hour) * 60 + Number(minute),
    };
  }

  private toDateKeyInTimezone(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);

    const year = this.getPart(parts, 'year');
    const month = this.getPart(parts, 'month');
    const day = this.getPart(parts, 'day');

    return `${year}-${month}-${day}`;
  }

  private toMonthDayKeyInTimezone(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const month = this.getPart(parts, 'month');
    const day = this.getPart(parts, 'day');
    return `${month}-${day}`;
  }

  private isMonthDayInRange(nowKey: string, startKey: string, endKey: string): boolean {
    if (startKey <= endKey) {
      return nowKey >= startKey && nowKey <= endKey;
    }

    return nowKey >= startKey || nowKey <= endKey;
  }

  private getPart(parts: Intl.DateTimeFormatPart[], partType: string): string {
    return parts.find((part) => part.type === partType)?.value ?? '';
  }

  private toMinutes(value: string): number {
    const trimmed = value.trim();
    const match = trimmed.match(TIME_24H_COLON_REGEX);

    if (!match) {
      throw new InternalServerErrorException(
        `Invalid time format: "${value}". Expected 24-hour HH:mm`,
      );
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }

  private isTimeInsideRange(nowMinutes: number, startTime: string, endTime: string): boolean {
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);
    return nowMinutes >= start && nowMinutes < end;
  }
}
