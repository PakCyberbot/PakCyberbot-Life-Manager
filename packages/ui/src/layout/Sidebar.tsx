import { CalendarDays, CheckSquare, LayoutDashboard, Library, Settings, Target, Wallet } from 'lucide-react';
import clsx from 'clsx';
import type { ScreenId } from '../navigation';
import { ThemeToggle } from '../theme/ThemeToggle';
import logo from '../assets/logo.png';

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof LayoutDashboard; accent: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'text-primary' },
  { id: 'goals', label: 'Goals', icon: Target, accent: 'text-accentGoals' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, accent: 'text-accentCalendar' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, accent: 'text-accentTasks' },
  { id: 'money', label: 'Money', icon: Wallet, accent: 'text-accentMoney' },
  { id: 'library', label: 'Library', icon: Library, accent: 'text-accentLibrary' },
];

export function Sidebar({ screen, onNavigate }: { screen: ScreenId; onNavigate: (s: ScreenId) => void }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" className="h-8 w-8 shrink-0 drop-shadow-sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted">PakCyberbot</p>
          <p className="truncate text-sm font-semibold">Life Manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon, accent }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:bg-background/60 hover:text-foreground'
              )}
            >
              <Icon size={17} className={active ? accent : undefined} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-border pt-3">
        <button
          onClick={() => onNavigate('settings')}
          className={clsx(
            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            screen === 'settings' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:bg-background/60 hover:text-foreground'
          )}
        >
          <Settings size={17} className={screen === 'settings' ? 'text-primary' : undefined} />
          Settings
        </button>
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[11px] text-muted">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
