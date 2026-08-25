import { Button } from '../ui/Button';
import { normalizeTime24 } from '../../utils/date-time';
import { TimeSelect } from './TimeSelect';

export interface LocalInterval {
  id: string;
  startTime: string;
  endTime: string;
  label?: string;
}

interface Props {
  title: string;
  intervals: LocalInterval[];
  onChange: (intervals: LocalInterval[]) => void;
  withLabel?: boolean;
  labelPlaceholder?: string;
}

const uid = () => Math.random().toString(36).slice(2);

export function TimeIntervalsEditor({
  title,
  intervals,
  onChange,
  withLabel = false,
  labelPlaceholder = 'Подпись',
}: Props) {
  const add = () => {
    onChange([...intervals, { id: uid(), startTime: '09:00', endTime: '18:00' }]);
  };

  const remove = (id: string) => {
    onChange(intervals.filter((i) => i.id !== id));
  };

  const update = (id: string, field: keyof LocalInterval, val: string) => {
    const nextValue =
      field === 'startTime' || field === 'endTime' ? normalizeTime24(val) : val;

    onChange(intervals.map((i) => (i.id === id ? { ...i, [field]: nextValue } : i)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{title}</span>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          + Добавить
        </Button>
      </div>

      {intervals.length === 0 && (
        <p className="text-xs italic text-muted">Нет интервалов</p>
      )}

      {intervals.map((interval) => (
        <div key={interval.id} className="flex flex-wrap items-center gap-2">
          <TimeSelect
            value={interval.startTime}
            onChange={(value) => update(interval.id, 'startTime', value)}
            ariaLabel="Время начала"
          />
          <span className="text-muted">—</span>
          <TimeSelect
            value={interval.endTime}
            onChange={(value) => update(interval.id, 'endTime', value)}
            ariaLabel="Время окончания"
          />
          {withLabel && (
            <input
              type="text"
              value={interval.label ?? ''}
              onChange={(e) => update(interval.id, 'label', e.target.value)}
              placeholder={labelPlaceholder}
              className="min-w-[120px] flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          )}
          <button
            type="button"
            onClick={() => remove(interval.id)}
            className="rounded-md p-1 text-muted hover:bg-danger-soft hover:text-danger"
            aria-label="Удалить"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
