type Color = 'green' | 'red' | 'yellow' | 'gray' | 'blue';

const COLORS: Record<Color, string> = {
  green: 'border border-success/30 bg-success-soft text-success',
  red: 'border border-danger/30 bg-danger-soft text-danger',
  yellow: 'border border-amber-300 bg-amber-50 text-amber-700',
  gray: 'border border-line bg-canvas text-muted',
  blue: 'border border-primary/30 bg-primary-soft text-primary',
};

interface Props {
  color?: Color;
  children: React.ReactNode;
}

export function Badge({ color = 'gray', children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[color]}`}
    >
      {children}
    </span>
  );
}
