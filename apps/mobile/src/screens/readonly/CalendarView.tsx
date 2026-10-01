import { useEffect, useMemo, useState } from 'react';
import { useCalendarStore } from '@life-manager/core';
import { formatDate, isPastEvent, relativeDayLabel, type CalendarEvent } from '@life-manager/shared';
import { Card, EmptyState } from '@life-manager/ui';
import { CalendarCheck2, CalendarClock, Trash2 } from 'lucide-react';
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

type Tab = 'upcoming' | 'archived';

export function CalendarView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { events, fetchEvents, removeEvent, loaded } = useCalendarStore();
  const [tab, setTab] = useState<Tab>('upcoming');

  useEffect(() => {
    if (!loaded) fetchEvents();
  }, [loaded, fetchEvents]);

  const now = new Date();

  // Same Upcoming/Archived split as desktop, same `isPastEvent` from packages/shared — "archived"
  // is computed live from startAt/endAt vs now, never a stored flag (see that helper's own doc
  // comment), so this can never drift out of sync with desktop's own split.
  const { upcoming, archived } = useMemo(() => {
    const up: CalendarEvent[] = [];
    const past: CalendarEvent[] = [];
    for (const e of events) (isPastEvent(e, now) ? past : up).push(e);
    up.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    return { upcoming: up, archived: past };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const list = tab === 'upcoming' ? upcoming : archived;

  return (
    <div>
      <SectionHeader title="Calendar" subtitle="Add/edit from desktop — archived events can be cleared here" onBack={() => onNavigate('more')} />

      <div className="mb-3 inline-flex w-full items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
        {([
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['archived', `Archived (${archived.length})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={clsx(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              tab === value ? 'bg-surface text-accentCalendar shadow-sm' : 'text-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyState icon={<CalendarClock size={24} />} title="No upcoming events" description="Add some on desktop and sync." />
        ) : (
          <EmptyState icon={<CalendarCheck2 size={24} />} title="Nothing archived yet" description="Past events land here automatically." />
        )
      ) : (
        <div className="space-y-2.5">
          {list.map((e) => (
            <Card key={e.id} className="flex items-start gap-3 p-3.5">
              <div className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', EVENT_COLOR_CLASS[e.color] ?? 'bg-accentCalendar')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted">
                  {relativeDayLabel(e.startAt, now)}
                  {!e.allDay && ` · ${new Date(e.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
                  {e.endAt && ` – ${formatDate(e.endAt)}`}
                </p>
                {e.description && <p className="mt-1 text-xs text-muted">{e.description}</p>}
              </div>
              {tab === 'archived' && (
                <button onClick={() => removeEvent(e.id)} className="shrink-0 text-muted active:text-red-500" title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
