import { useEffect, useMemo, useState } from 'react';
import type { Campaign, CreateSchedulePayload, Schedule } from '../../types/api.types';
import { schedulesApi } from '../../api/schedules.api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CampaignSearch } from './CampaignSearch';
import { WeekdayPicker } from './WeekdayPicker';
import {
  TimeIntervalsEditor,
  type LocalInterval,
} from './TimeIntervalsEditor';
import { ExceptionsEditor, type LocalException } from './ExceptionsEditor';
import { isTime24, normalizeTime24 } from '../../utils/date-time';

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialValues?: Schedule | null;
  onCreated?: (schedule: Schedule) => void;
  onUpdated?: (schedule: Schedule) => void;
}

const TIMEZONES = [
  'Europe/Moscow',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Almaty',
  'Asia/Novosibirsk',
  'Asia/Yekaterinburg',
  'Asia/Vladivostok',
  'UTC',
];

const uid = () => Math.random().toString(36).slice(2);

function dedupeIntervals<T extends { startTime: string; endTime: string; label?: string | null }>(
  intervals: T[],
) {
  const seen = new Set<string>();

  return intervals.reduce<LocalInterval[]>((acc, interval) => {
    const key = `${interval.startTime}-${interval.endTime}-${interval.label ?? ''}`;
    if (seen.has(key)) {
      return acc;
    }

    seen.add(key);
    acc.push({
      id: uid(),
      startTime: normalizeTime24(interval.startTime),
      endTime: normalizeTime24(interval.endTime),
      label: interval.label ?? undefined,
    });
    return acc;
  }, []);
}

export function ScheduleModal({
  open,
  onClose,
  mode = 'create',
  initialValues = null,
  onCreated,
  onUpdated,
}: Props) {
  const isEditMode = mode === 'edit' && initialValues !== null;
  const [name, setName] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [timezone, setTimezone] = useState('Europe/Moscow');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workIntervals, setWorkIntervals] = useState<LocalInterval[]>([
    { id: uid(), startTime: '09:00', endTime: '18:00' },
  ]);
  const [breakIntervals, setBreakIntervals] = useState<LocalInterval[]>([]);
  const [exceptions, setExceptions] = useState<LocalException[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const normalizedInitialValues = useMemo(() => {
    if (!initialValues) {
      return null;
    }

    return {
      name: initialValues.name,
      campaign: {
        id: Number(initialValues.campaignId),
        title: initialValues.campaignTitle,
        status: initialValues.runtimeState?.currentState ?? 'unknown',
      },
      timezone: initialValues.campaignTimezone || 'Europe/Moscow',
      startDate: initialValues.startDate?.slice(0, 10) ?? '',
      endDate: initialValues.endDate?.slice(0, 10) ?? '',
      notes: initialValues.notes ?? '',
      weekdays: initialValues.weekdays
        .filter((item) => item.isActive)
        .map((item) => item.weekday)
        .sort((left, right) => left - right),
      workIntervals: dedupeIntervals(initialValues.workIntervals),
      breakIntervals: dedupeIntervals(initialValues.breakIntervals),
      exceptions: initialValues.exceptions.map((exception) => ({
        id: exception.id,
        startDate: exception.startDate.slice(0, 10),
        endDate: exception.endDate.slice(0, 10),
        type: exception.type,
        customStartTime: normalizeTime24(exception.customStartTime ?? '09:00'),
        customEndTime: normalizeTime24(exception.customEndTime ?? '18:00'),
        title: exception.title ?? '',
        isRecurringYearly: exception.isRecurringYearly,
      })),
    };
  }, [initialValues]);

  const reset = () => {
    if (normalizedInitialValues) {
      setName(normalizedInitialValues.name);
      setCampaign(normalizedInitialValues.campaign);
      setTimezone(normalizedInitialValues.timezone);
      setStartDate(normalizedInitialValues.startDate);
      setEndDate(normalizedInitialValues.endDate);
      setNotes(normalizedInitialValues.notes);
      setWeekdays(normalizedInitialValues.weekdays);
      setWorkIntervals(
        normalizedInitialValues.workIntervals.length > 0
          ? normalizedInitialValues.workIntervals
          : [{ id: uid(), startTime: '09:00', endTime: '18:00' }],
      );
      setBreakIntervals(normalizedInitialValues.breakIntervals);
      setExceptions(normalizedInitialValues.exceptions);
    } else {
      setName('');
      setCampaign(null);
      setTimezone('Europe/Moscow');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setWeekdays([1, 2, 3, 4, 5]);
      setWorkIntervals([{ id: uid(), startTime: '09:00', endTime: '18:00' }]);
      setBreakIntervals([]);
      setExceptions([]);
    }
    setErrors({});
  };

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, normalizedInitialValues]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Введите название расписания';
    if (!campaign) errs.campaign = 'Выберите кампанию';
    if (weekdays.length === 0) errs.weekdays = 'Выберите хотя бы один день недели';
    if (workIntervals.length === 0) errs.work = 'Добавьте хотя бы один рабочий интервал';

    for (const interval of workIntervals) {
      const startTime = normalizeTime24(interval.startTime);
      const endTime = normalizeTime24(interval.endTime);

      if (!isTime24(startTime) || !isTime24(endTime)) {
        errs.work = 'Используйте 24-часовой формат времени HH:mm';
        break;
      }

      if (startTime >= endTime) {
        errs.work = 'Время начала должно быть меньше времени окончания';
        break;
      }
    }

    if (!errs.work) {
      for (const interval of breakIntervals) {
        const startTime = normalizeTime24(interval.startTime);
        const endTime = normalizeTime24(interval.endTime);

        if (!isTime24(startTime) || !isTime24(endTime)) {
          errs.work = 'Используйте 24-часовой формат времени HH:mm';
          break;
        }

        if (startTime >= endTime) {
          errs.work = 'Время начала должно быть меньше времени окончания';
          break;
        }
      }
    }

    if (!errs.work) {
      for (const exception of exceptions) {
        if (exception.endDate < exception.startDate) {
          errs.work = 'Исключения: дата окончания не может быть раньше даты начала';
          break;
        }
      }
    }

    if (!errs.work) {
      for (const exception of exceptions) {
        if (exception.type !== 'custom_working_hours') {
          continue;
        }

        const customStartTime = normalizeTime24(exception.customStartTime);
        const customEndTime = normalizeTime24(exception.customEndTime);

        if (!isTime24(customStartTime) || !isTime24(customEndTime)) {
          errs.work = 'Исключения: используйте 24-часовой формат времени HH:mm';
          break;
        }

        if (customStartTime >= customEndTime) {
          errs.work = 'Исключения: время начала должно быть меньше времени окончания';
          break;
        }
      }
    }

    if (startDate && endDate && endDate < startDate) {
      errs.dates = 'Дата окончания не может быть раньше даты начала';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !campaign) return;

    const expandedWorkIntervals = weekdays.flatMap((weekday) =>
      workIntervals.map((i) => ({
        weekday,
        startTime: normalizeTime24(i.startTime),
        endTime: normalizeTime24(i.endTime),
      })),
    );

    const expandedBreakIntervals = weekdays.flatMap((weekday) =>
      breakIntervals.map((i) => ({
        weekday,
        startTime: normalizeTime24(i.startTime),
        endTime: normalizeTime24(i.endTime),
        label: i.label || undefined,
      })),
    );

    const payload: CreateSchedulePayload = {
      name: name.trim(),
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignTimezone: timezone,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      notes: notes.trim() || undefined,
      weekdays,
      workIntervals: expandedWorkIntervals,
      breakIntervals: expandedBreakIntervals.length > 0 ? expandedBreakIntervals : undefined,
      exceptions:
        exceptions.length > 0
          ? exceptions.map((ex) => ({
              startDate: ex.startDate,
              endDate: ex.endDate,
              type: ex.type,
              customStartTime:
                ex.type === 'custom_working_hours'
                  ? normalizeTime24(ex.customStartTime)
                  : undefined,
              customEndTime:
                ex.type === 'custom_working_hours'
                  ? normalizeTime24(ex.customEndTime)
                  : undefined,
              title: ex.title || undefined,
              isRecurringYearly: ex.isRecurringYearly,
            }))
          : undefined,
    };

    setSubmitting(true);
    try {
      if (isEditMode && initialValues) {
        const updated = await schedulesApi.update(initialValues.id, payload);
        onUpdated?.(updated.schedule);
      } else {
        const created = await schedulesApi.create(payload);
        onCreated?.(created);
      }
      reset();
      onClose();
    } catch (e) {
      setErrors({
        submit:
          e instanceof Error ? e.message : 'Ошибка создания расписания. Попробуйте снова.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditMode ? 'Редактировать расписание' : 'Задать расписание'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pb-2">
        <Input
          label="Название расписания"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Напр. Рабочие будни 9-18"
          error={errors.name}
        />

        <div>
          <CampaignSearch value={campaign} onChange={setCampaign} />
          {errors.campaign && <p className="mt-1 text-xs text-danger">{errors.campaign}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Часовой пояс</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Дата начала <span className="text-muted">(необяз.)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Дата окончания <span className="text-muted">(необяз.)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </div>
        {errors.dates && <p className="text-xs text-danger">{errors.dates}</p>}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Рабочие дни недели</p>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          {errors.weekdays && <p className="mt-1 text-xs text-danger">{errors.weekdays}</p>}
        </div>

        <div className="rounded-lg border border-line bg-canvas/50 p-4">
          <TimeIntervalsEditor
            title="Рабочие часы (применяются ко всем выбранным дням)"
            intervals={workIntervals}
            onChange={setWorkIntervals}
          />
          {errors.work && <p className="mt-1 text-xs text-danger">{errors.work}</p>}
        </div>

        <div className="rounded-lg border border-line bg-canvas/50 p-4">
          <TimeIntervalsEditor
            title="Перерывы (компания будет отключаться)"
            intervals={breakIntervals}
            onChange={setBreakIntervals}
            withLabel
            labelPlaceholder="Напр. Обед"
          />
        </div>

        <div className="rounded-lg border border-line bg-canvas/50 p-4">
          <ExceptionsEditor exceptions={exceptions} onChange={setExceptions} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Заметки <span className="text-muted">(необяз.)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Любые комментарии к расписанию..."
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </div>

        {errors.submit && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.submit}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Отмена
          </Button>
          <Button type="button" loading={submitting} onClick={handleSubmit}>
            {isEditMode ? 'Сохранить изменения' : 'Сохранить расписание'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
