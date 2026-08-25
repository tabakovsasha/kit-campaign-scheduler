import { useState } from 'react';
import type { Schedule } from '../../types/api.types';
import { schedulesApi } from '../../api/schedules.api';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DAYS } from './WeekdayPicker';
import { formatTimeHHmm } from '../../utils/date-time';

interface Props {
  schedule: Schedule;
  nowTs: number;
  onToggled: (updated: Schedule) => void;
  onDeleted: (updated: Schedule) => void;
  onRestored: (updated: Schedule) => void;
  onLogsClick: (schedule: Schedule) => void;
  onEditClick: (schedule: Schedule) => void;
}

const formatCountdown = (seconds: number | null) => {
  if (seconds === null || Number.isNaN(seconds)) {
    return '—';
  }

  const total = Math.max(0, seconds);
  const hh = Math.floor(total / 3600)
    .toString()
    .padStart(2, '0');
  const mm = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};

export function ScheduleCard({
  schedule,
  nowTs,
  onToggled,
  onDeleted,
  onRestored,
  onLogsClick,
  onEditClick,
}: Props) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const actualCampaignStatus = schedule.campaign_actual_status ?? 'unknown';
  const deletedCountdown =
    schedule.isDeleted && schedule.purgeAt
      ? Math.max(0, Math.floor((new Date(schedule.purgeAt).getTime() - nowTs) / 1000))
      : schedule.remainingSeconds;

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await schedulesApi.toggle(schedule.id, enabled);
      onToggled(res.schedule);
    } catch {
      /* keep current state */
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Удалить расписание? Оно будет доступно для восстановления 24 часа.',
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const res = await schedulesApi.delete(schedule.id);
      onDeleted(res.schedule);
    } catch {
      /* noop */
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await schedulesApi.restore(schedule.id);
      onRestored(res.schedule);
    } catch {
      /* noop */
    } finally {
      setRestoring(false);
    }
  };

  const activeDays = schedule.weekdays
    .filter((w) => w.isActive)
    .sort((a, b) => a.weekday - b.weekday)
    .map((w) => DAYS.find((d) => d.num === w.weekday)?.short ?? `#${w.weekday}`)
    .join(', ');

  const workHours = schedule.workIntervals
    .filter((i) => i.weekday === (schedule.weekdays.find((w) => w.isActive)?.weekday ?? 1))
    .map((i) => `${formatTimeHHmm(i.startTime)}–${formatTimeHHmm(i.endTime)}`)
    .join(', ');

  const runtimeBadge = schedule.runtimeState?.currentState;

  return (
    <div
      className={[
        'animate-fade-up rounded-xl border border-line p-4 shadow-card transition-all',
        schedule.isDeleted
          ? 'bg-canvas text-muted grayscale'
          : 'bg-surface hover:-translate-y-0.5 hover:bg-canvas/40',
        schedule.isEnabled ? 'ring-1 ring-primary/10' : '',
      ].join(' ')}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-ink">{schedule.name}</span>
            {schedule.isDeleted && <Badge color="gray">Удалено</Badge>}
            <Badge color={schedule.isEnabled ? 'blue' : 'gray'}>
              {schedule.isEnabled ? 'Включено' : 'Отключено'}
            </Badge>
            {runtimeBadge === 'resumed' && (
              <Badge color="green">Работает</Badge>
            )}
            {runtimeBadge === 'paused' && (
              <Badge color="gray">Пауза</Badge>
            )}
          </div>

          <p className="text-sm text-muted">
            Кампания:{' '}
            <span className="font-semibold text-ink">
              {schedule.campaignTitle}#{schedule.campaignId}
            </span>{' '}
            <span className="text-muted">
              , status:{' '}
              <span
                className={[
                  'font-semibold',
                  schedule.isDeleted ? 'text-muted' : 'text-primary',
                ].join(' ')}
              >
                {actualCampaignStatus}
              </span>
            </span>
          </p>

          {schedule.isDeleted && (
            <p className="text-xs font-semibold text-muted">
              Удалится через: {formatCountdown(deletedCountdown)}
            </p>
          )}

          <div className="grid gap-2 border-y border-line/80 py-3 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="font-semibold text-ink">Дни:</span> {activeDays || '—'}
            </div>
            <div>
              <span className="font-semibold text-ink">Рабочее время:</span> {workHours || '—'}
            </div>
            <div>
              <span className="font-semibold text-ink">Перерывы:</span>{' '}
              {schedule.breakIntervals.length}
            </div>
            <div>
              <span className="font-semibold text-ink">Исключения:</span>{' '}
              {schedule.exceptions.length}
            </div>
            {schedule.campaignTimezone && (
              <div className="sm:col-span-2 lg:col-span-4">
                <span className="font-semibold text-ink">Часовой пояс:</span>{' '}
                {schedule.campaignTimezone}
              </div>
            )}
          </div>

          {schedule.runtimeState?.lastDecisionReason && (
            <p className="text-xs text-muted">
              Последнее решение: {schedule.runtimeState.lastDecisionReason}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <Toggle
            checked={schedule.isEnabled}
            onChange={handleToggle}
            disabled={toggling || schedule.isDeleted}
            label={schedule.isEnabled ? 'Активно' : 'Выключено'}
          />
          <div className="flex items-center gap-2">
            {schedule.isDeleted ? (
              <Button variant="secondary" size="sm" onClick={handleRestore} loading={restoring}>
                Восстановить кампанию
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={() => onEditClick(schedule)}>
                  Редактировать
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                  Удалить
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => onLogsClick(schedule)}>
              Логи
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
