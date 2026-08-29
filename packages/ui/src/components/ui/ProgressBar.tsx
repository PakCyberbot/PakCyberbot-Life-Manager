import clsx from 'clsx';

export function ProgressBar({
  value,
  toneClassName = 'bg-primary',
  className,
}: {
  value: number;
  toneClassName?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-border/70', className)}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-300', toneClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
