import { Laptop, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme, type ThemePreference } from './ThemeProvider';

const options: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Laptop, label: 'System' },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setPreference(value)}
          title={label}
          aria-label={label}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            preference === value ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
