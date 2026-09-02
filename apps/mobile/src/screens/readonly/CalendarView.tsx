import { useEffect, useMemo } from 'react';
import { useCalendarStore } from '@life-manager/core';
import { formatDate } from '@life-manager/shared';
import { Card, EmptyState } from '@life-manager/ui';
import { CalendarDays } from 'lucide-react';
import clsx from 'clsx';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

// Same event-color palette as desktop's CalendarScreen (packages/ui) — kept
// in sync manually since that mapping is local to that screen, not exported.
const EVENT_COLOR_CLASS: Record<string, string> = {
  blue: 'bg-accentCalendar',
  violet: 'bg-accentGoals',
  amber: 'bg-accentTasks',
  emerald: 'bg-accentMoney',
};

export function CalendarView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { events, fetchEvents, loaded } = useCalendarStore();

  useEffect(() => {
    if (!loaded) fetchEvents();
  }, [loaded, fetchEvents]);

  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [events]);

  return (
    <div>
      <SectionHeader title="Calendar" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {sorted.length === 0 ? (
        <EmptyState icon={<CalendarDays size={24} />} title="No events yet" description="Add some on desktop and sync." />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((e) => (
            <Card key={e.id} className="flex items-start gap-3 p-3.5">
              <div className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', EVENT_COLOR_CLASS[e.color] ?? 'bg-accentCalendar')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted">
                  {formatDate(e.startAt)}
                  {e.endAt && ` – ${formatDate(e.endAt)}`}
                </p>
                {e.description && <p className="mt-1 text-xs text-muted">{e.description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
