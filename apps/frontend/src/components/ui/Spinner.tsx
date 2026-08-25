interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-4',
};

export function Spinner({ size = 'md' }: Props) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-primary border-t-transparent ${SIZES[size]}`}
    />
  );
}
