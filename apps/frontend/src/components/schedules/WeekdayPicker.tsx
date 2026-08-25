const DAYS: { num: number; label: string; short: string }[] = [
  { num: 1, label: 'Понедельник', short: 'Пн' },
  { num: 2, label: 'Вторник', short: 'Вт' },
  { num: 3, label: 'Среда', short: 'Ср' },
  { num: 4, label: 'Четверг', short: 'Чт' },
  { num: 5, label: 'Пятница', short: 'Пт' },
  { num: 6, label: 'Суббота', short: 'Сб' },
  { num: 7, label: 'Воскресенье', short: 'Вс' },
];

interface Props {
  value: number[];
  onChange: (days: number[]) => void;
}

export function WeekdayPicker({ value, onChange }: Props) {
  const toggle = (num: number) => {
    if (value.includes(num)) {
      onChange(value.filter((d) => d !== num));
    } else {
      onChange([...value, num].sort((a, b) => a - b));
    }
  };

  const selectWorkdays = () => onChange([1, 2, 3, 4, 5]);
  const selectAll = () => onChange([1, 2, 3, 4, 5, 6, 7]);
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => {
          const active = value.includes(day.num);
          const isWeekend = day.num >= 6;
          return (
            <button
              key={day.num}
              type="button"
              title={day.label}
              onClick={() => toggle(day.num)}
              className={[
                'h-10 w-10 rounded-lg border text-sm font-semibold transition-colors',
                active
                  ? isWeekend
                    ? 'border-danger bg-danger text-white'
                    : 'border-primary bg-primary text-white'
                  : isWeekend
                    ? 'border-danger/30 bg-danger-soft text-danger hover:bg-danger/15'
                    : 'border-line bg-surface text-muted hover:bg-primary-soft',
              ].join(' ')}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={selectWorkdays} className="text-primary underline hover:no-underline">
          Только будни
        </button>
        <span className="text-muted/50">|</span>
        <button type="button" onClick={selectAll} className="text-primary underline hover:no-underline">
          Все дни
        </button>
        <span className="text-muted/50">|</span>
        <button type="button" onClick={clearAll} className="text-muted underline hover:no-underline">
          Очистить
        </button>
      </div>
    </div>
  );
}

export { DAYS };
