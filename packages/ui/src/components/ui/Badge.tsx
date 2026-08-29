import { type HTMLAttributes } from 'react';
import clsx from 'clsx';

type Tone = 'default' | 'goals' | 'calendar' | 'tasks' | 'money' | 'library' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  default: 'bg-muted/15 text-muted',
  goals: 'bg-accentGoals/15 text-accentGoals',
  calendar: 'bg-accentCalendar/15 text-accentCalendar',
  tasks: 'bg-accentTasks/15 text-accentTasks',
  money: 'bg-accentMoney/15 text-accentMoney',
  library: 'bg-accentLibrary/15 text-accentLibrary',
  success: 'bg-emerald-500/15 text-emerald-500',
  warning: 'bg-amber-500/15 text-amber-500',
  danger: 'bg-red-500/15 text-red-500',
};

export function Badge({
  tone = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
