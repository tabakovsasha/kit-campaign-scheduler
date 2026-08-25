import { isTime24, normalizeTime24 } from '../../utils/date-time';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function splitTime(value: string): { hour: string; minute: string } {
  const normalized = normalizeTime24(value);
  if (isTime24(normalized)) {
    const [hour, minute] = normalized.split(':');
    return { hour, minute };
  }

  return { hour: '00', minute: '00' };
}

export function TimeSelect({ value, onChange, disabled = false, ariaLabel }: Props) {
  const { hour, minute } = splitTime(value);

  const handleHourChange = (nextHour: string) => {
    onChange(`${nextHour}:${minute}`);
  };

  const handleMinuteChange = (nextMinute: string) => {
    onChange(`${hour}:${nextMinute}`);
  };

  const baseClassName =
    'rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} (часы)` : 'Часы'}
        className={baseClassName}
      >
        {HOURS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <select
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} (минуты)` : 'Минуты'}
        className={baseClassName}
      >
        {MINUTES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
