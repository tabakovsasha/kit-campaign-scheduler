interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label
      className={[
        'inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={[
            'h-6 w-11 rounded-full border transition-colors',
            checked ? 'border-primary bg-primary' : 'border-line bg-line/70',
          ].join(' ')}
        />
        <div
          className={[
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </div>
      {label && <span className="text-sm font-medium text-muted">{label}</span>}
    </label>
  );
}
