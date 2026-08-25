import { Button } from '../ui/Button';
import { normalizeTime24 } from '../../utils/date-time';
import { TimeSelect } from './TimeSelect';

export interface LocalException {
  id: string;
  startDate: string;
  endDate: string;
  type: 'day_off' | 'custom_working_hours';
  customStartTime: string;
  customEndTime: string;
  title: string;
  isRecurringYearly: boolean;
}

interface Props {
  exceptions: LocalException[];
  onChange: (exceptions: LocalException[]) => void;
}

const uid = () => Math.random().toString(36).slice(2);

const formatDateRu = (date: string) => {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    return date;
  }

  return `${day}.${month}.${year}`;
};

const formatRangeLabel = (startDate: string, endDate: string) => {
  if (startDate === endDate) {
    return formatDateRu(startDate);
  }

  return `${formatDateRu(startDate)} - ${formatDateRu(endDate)}`;
};

export function ExceptionsEditor({ exceptions, onChange }: Props) {
  const add = () => {
    const today = new Date().toISOString().slice(0, 10);
    onChange([
      ...exceptions,
      {
        id: uid(),
        startDate: today,
        endDate: today,
        type: 'day_off',
        customStartTime: '09:00',
        customEndTime: '18:00',
        title: '',
        isRecurringYearly: false,
      },
    ]);
  };

  const remove = (id: string) => onChange(exceptions.filter((e) => e.id !== id));

  const update = <K extends keyof LocalException>(id: string, field: K, val: LocalException[K]) => {
    onChange(exceptions.map((e) => (e.id === id ? { ...e, [field]: val } : e)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Исключения (праздники, особые дни)</span>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          + Добавить
        </Button>
      </div>

      {exceptions.length === 0 && (
        <p className="text-xs italic text-muted">Нет исключений</p>
      )}

      {exceptions.map((ex) => (
        <div
          key={ex.id}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
        >
          <p className="text-xs font-medium text-muted">
            Диапазон: {formatRangeLabel(ex.startDate, ex.endDate)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">с</span>
              <input
                type="date"
                value={ex.startDate}
                onChange={(e) => update(ex.id, 'startDate', e.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">по</span>
              <input
                type="date"
                value={ex.endDate}
                min={ex.startDate}
                onChange={(e) => update(ex.id, 'endDate', e.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <select
              value={ex.type}
              onChange={(e) =>
                update(ex.id, 'type', e.target.value as LocalException['type'])
              }
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            >
              <option value="day_off">Выходной день</option>
              <option value="custom_working_hours">Особые часы</option>
            </select>

            <input
              type="text"
              value={ex.title}
              onChange={(e) => update(ex.id, 'title', e.target.value)}
              placeholder="Название (напр. Новый год)"
              className="min-w-[160px] flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />

            <button
              type="button"
              onClick={() => remove(ex.id)}
              className="ml-auto rounded-md p-1 text-muted hover:bg-danger-soft hover:text-danger"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {ex.type === 'custom_working_hours' && (
            <div className="flex flex-wrap items-center gap-2 pl-1">
              <span className="text-xs text-muted">Часы работы:</span>
              <TimeSelect
                value={ex.customStartTime}
                onChange={(value) =>
                  update(ex.id, 'customStartTime', normalizeTime24(value))
                }
                ariaLabel="Особое время начала"
              />
              <span className="text-muted">—</span>
              <TimeSelect
                value={ex.customEndTime}
                onChange={(value) =>
                  update(ex.id, 'customEndTime', normalizeTime24(value))
                }
                ariaLabel="Особое время окончания"
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 pl-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={ex.isRecurringYearly}
              onChange={(e) => update(ex.id, 'isRecurringYearly', e.target.checked)}
              className="h-4 w-4 rounded border-line text-primary focus:ring-primary/20"
            />
            Повторять ежегодно
          </label>
        </div>
      ))}
    </div>
  );
}
