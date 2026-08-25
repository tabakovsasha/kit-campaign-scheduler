import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...rest }: Props) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-ink" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        {...rest}
        id={inputId}
        className={[
          'w-full rounded-md border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line',
          className,
        ].join(' ')}
      />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
