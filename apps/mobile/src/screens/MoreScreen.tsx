import {
  Banknote,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  HeartPulse,
  Newspaper,
  Settings as SettingsIcon,
  Target,
  Wallet,
} from 'lucide-react';
import { useSettingsStore } from '@life-manager/core';
import type { ToggleableSectionId } from '@life-manager/shared';
import { Card } from '@life-manager/ui';
import type { MobileScreenId, ReadOnlySectionId } from '../navigation';

const SECTIONS: { id: ReadOnlySectionId; label: string; icon: typeof Target; accent: string }[] = [
  { id: 'goals', label: 'Goals', icon: Target, accent: 'text-accentGoals bg-accentGoals/10' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, accent: 'text-accentCalendar bg-accentCalendar/10' },
  { id: 'money', label: 'Savings', icon: Wallet, accent: 'text-accentMoney bg-accentMoney/10' },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, accent: 'text-accentLibrary bg-accentLibrary/10' },
  { id: 'earningWays', label: 'Earning Ways', icon: Banknote, accent: 'text-accentMoney bg-accentMoney/10' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, accent: 'text-accentTasks bg-accentTasks/10' },
  { id: 'health', label: 'Health', icon: HeartPulse, accent: 'text-accentHealth bg-accentHealth/10' },
  { id: 'news', label: 'News & Updates', icon: Newspaper, accent: 'text-accentCalendar bg-accentCalendar/10' },
];

// Everything here is view-only — same data as desktop (once Drive sync lands
// in Phase 2), no add/edit/refresh actions. Respects enabledSections since
// that setting syncs the same as everything else in the DB.
export function MoreScreen({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const enabledSections = useSettingsStore((s) => s.enabledSections);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">More</h1>
        <p className="mt-1 text-sm text-muted">A quick look at everything else — view only.</p>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {SECTIONS.filter((s) => enabledSections[s.id as ToggleableSectionId] !== false).map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-background"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${section.accent}`}>
                <Icon size={16} />
              </div>
              <span className="flex-1 text-sm font-medium">{section.label}</span>
              <ChevronRight size={16} className="text-muted" />
            </button>
          );
        })}
      </Card>

      <Card className="overflow-hidden">
        <button
          onClick={() => onNavigate('settings')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-background"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/15 text-muted">
            <SettingsIcon size={16} />
          </div>
          <span className="flex-1 text-sm font-medium">Settings</span>
          <ChevronRight size={16} className="text-muted" />
        </button>
      </Card>
    </div>
  );
}
