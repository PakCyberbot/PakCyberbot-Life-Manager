import { useEffect } from 'react';
import {
  Banknote,
  Briefcase,
  CalendarDays,
  CalendarClock,
  CheckSquare,
  Clapperboard,
  FolderTree,
  HeartPulse,
  LayoutDashboard,
  Library,
  Newspaper,
  Settings,
  Target,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { useSettingsStore } from '@life-manager/core';
import type { ToggleableSectionId } from '@life-manager/shared';
import type { ScreenId } from '../navigation';
import { ThemeToggle } from '../theme/ThemeToggle';
import logo from '../assets/logo.png';

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof LayoutDashboard; accent: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'text-primary' },
  { id: 'goals', label: 'Goals', icon: Target, accent: 'text-accentGoals' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, accent: 'text-accentCalendar' },
  { id: 'timeTable', label: 'Time Table', icon: CalendarClock, accent: 'text-accentCalendar' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, accent: 'text-accentTasks' },
  { id: 'money', label: 'Money', icon: Wallet, accent: 'text-accentMoney' },
  { id: 'library', label: 'Library', icon: Library, accent: 'text-accentLibrary' },
  { id: 'news', label: 'News & Updates', icon: Newspaper, accent: 'text-accentCalendar' },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, accent: 'text-accentLibrary' },
  { id: 'earningWays', label: 'Earning Ways', icon: Banknote, accent: 'text-accentMoney' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, accent: 'text-accentTasks' },
  { id: 'fileManager', label: 'File Manager', icon: FolderTree, accent: 'text-accentTasks' },
  { id: 'health', label: 'Health', icon: HeartPulse, accent: 'text-accentHealth' },
];

export function Sidebar({ screen, onNavigate }: { screen: ScreenId; onNavigate: (s: ScreenId) => void }) {
  const { enabledSections, loaded, load } = useSettingsStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // 'dashboard' isn't a toggleable section (always on) — only check the map for ids that are.
  const navItems = NAV_ITEMS.filter((item) => enabledSections[item.id as ToggleableSectionId] !== false);

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
        {navItems.map(({ id, label, icon: Icon, accent }) => {
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
