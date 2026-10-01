import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarCheck2, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCalendarStore } from '@life-manager/core';
import { toLocalDateKey, isSameMonth, isPastEvent, relativeDayLabel, type CalendarEvent } from '@life-manager/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, Input } from '../components/ui/FormControls';
import clsx from 'clsx';

const EVENT_COLORS: { value: string; className: string }[] = [
  { value: 'blue', className: 'bg-accentCalendar' },
  { value: 'violet', className: 'bg-accentGoals' },
  { value: 'amber', className: 'bg-accentTasks' },
  { value: 'emerald', className: 'bg-accentMoney' },
];

function colorClass(color: string) {
  return EVENT_COLORS.find((c) => c.value === color)?.className ?? 'bg-accentCalendar';
}

// "HH:MM" from a Date's own local hour/minute — what <input type="time"> needs, and distinct from
// toLocaleTimeString (locale-formatted, often 12h with AM/PM, not what that input accepts).
function toLocalTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Tab = 'upcoming' | 'archived';

export function CalendarScreen() {
  const { events, fetchEvents, addEvent, updateEvent, removeEvent, loaded } = useCalendarStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');

  useEffect(() => {
    if (!loaded) fetchEvents();
  }, [loaded, fetchEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      // Always derive the day from a real Date's local components — never slice the raw stored
      // string, which may be a UTC-serialized instant that lands on a different calendar day than
      // the one the viewer actually sees it on (see toLocalDateKey's own doc comment).
      const key = toLocalDateKey(new Date(e.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const eventsThisMonth = useMemo(() => events.filter((e) => isSameMonth(e.startAt, cursor)).length, [events, cursor]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) days.push({ date: new Date(year, month, d), inMonth: true });
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      days.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return days;
  }, [cursor]);

  const now = new Date();
  const today = toLocalDateKey(now);

  const { upcoming, archived } = useMemo(() => {
    const up: CalendarEvent[] = [];
    const past: CalendarEvent[] = [];
    for (const e of events) (isPastEvent(e, now) ? past : up).push(e);
    up.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    return { upcoming: up, archived: past };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const openDayDialog = (date: Date) => {
    setEditingEvent(null);
    setSelectedDate(date);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.startAt));
  };

  const closeDialog = () => {
    setSelectedDate(null);
    setEditingEvent(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            Click a day to add or view events. {eventsThisMonth > 0 && `${eventsThisMonth} event${eventsThisMonth === 1 ? '' : 's'} this month.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-surface/60 text-center text-xs font-medium text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={d} className={clsx('py-2', (i === 0 || i === 6) && 'text-accentCalendar/70')}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(({ date, inMonth }, i) => {
            const key = toLocalDateKey(date);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === today;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <button
                key={i}
                onClick={() => openDayDialog(date)}
                className={clsx(
                  'flex min-h-[92px] flex-col items-start gap-1 border-b border-r border-border p-2 text-left transition-colors hover:bg-surface',
                  !inMonth && 'text-muted/50',
                  inMonth && isWeekend && 'bg-background/40',
                  (i + 1) % 7 === 0 && 'border-r-0'
                )}
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors',
                    isToday && 'bg-primary font-semibold text-white ring-2 ring-primary/40 ring-offset-1 ring-offset-surface'
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="flex w-full flex-1 flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div key={e.id} className="flex items-center gap-1 truncate text-[11px]">
                      <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', colorClass(e.color))} />
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && <span className="text-[11px] text-muted">+{dayEvents.length - 3} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {([
            ['upcoming', `Upcoming (${upcoming.length})`],
            ['archived', `Archived (${archived.length})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={clsx(
                'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === value ? 'bg-surface text-accentCalendar shadow-sm' : 'text-muted hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={28} />} title="No upcoming events" description="Click a day on the calendar above to add one." />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} now={now} onEdit={() => openEditDialog(e)} onRemove={() => removeEvent(e.id)} />
              ))}
            </div>
          )
        ) : archived.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 size={28} />} title="Nothing archived yet" description="Past events land here automatically once their date passes." />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {archived.map((e) => (
              <EventCard key={e.id} event={e} now={now} onRemove={() => removeEvent(e.id)} />
            ))}
          </div>
        )}
      </div>

      {selectedDate && (
        <DayDialog
          date={selectedDate}
          events={editingEvent ? [] : eventsByDay.get(toLocalDateKey(selectedDate)) ?? []}
          editingEvent={editingEvent}
          onClose={closeDialog}
          onAdd={addEvent}
          onUpdate={updateEvent}
          onRemove={removeEvent}
        />
      )}
    </div>
  );
}

function EventCard({
  event,
  now,
  onEdit,
  onRemove,
}: {
  event: CalendarEvent;
  now: Date;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className={clsx('flex items-start gap-3 border-l-4 p-3.5', colorClass(event.color).replace('bg-', 'border-l-'))}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {relativeDayLabel(event.startAt, now)}
          {!event.allDay && ` · ${new Date(event.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
        </p>
        {event.description && <p className="mt-1 text-xs text-muted">{event.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onEdit && (
          <button onClick={onEdit} className="text-muted hover:text-foreground" title="Edit">
            <Pencil size={13} />
          </button>
        )}
        <button onClick={onRemove} className="text-muted hover:text-red-500" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </Card>
  );
}

function DayDialog({
  date,
  events,
  editingEvent,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  date: Date;
  events: CalendarEvent[];
  editingEvent: CalendarEvent | null;
  onClose: () => void;
  onAdd: ReturnType<typeof useCalendarStore.getState>['addEvent'];
  onUpdate: ReturnType<typeof useCalendarStore.getState>['updateEvent'];
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [time, setTime] = useState(editingEvent && !editingEvent.allDay ? toLocalTimeInputValue(new Date(editingEvent.startAt)) : '09:00');
  const [allDay, setAllDay] = useState(!!editingEvent?.allDay);
  const [color, setColor] = useState(editingEvent?.color ?? 'blue');

  const submit = async () => {
    if (!title.trim()) return;
    // The date part always comes from this Date's own local components (never
    // date.toISOString().slice(...), which silently shifts to the previous day in any
    // positive-UTC-offset timezone) — this is the fix for events saving under the wrong day.
    const datePart = toLocalDateKey(date);
    const startAt = allDay ? datePart : new Date(`${datePart}T${time}`).toISOString();
    if (editingEvent) {
      await onUpdate(editingEvent.id, { title: title.trim(), startAt, allDay: allDay ? 1 : 0, color });
      onClose();
    } else {
      await onAdd({ title: title.trim(), startAt, allDay, color });
      setTitle('');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editingEvent ? 'Edit event' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
    >
      <div className="space-y-4">
        {!editingEvent && (
          <div className="space-y-1.5">
            {events.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-sm">
                <span className={clsx('h-2 w-2 shrink-0 rounded-full', colorClass(e.color))} />
                <span className="flex-1">{e.title}</span>
                {!e.allDay && (
                  <span className="text-xs text-muted">
                    {new Date(e.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button onClick={() => onRemove(e.id)} className="text-muted hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-3">
          <Field label={editingEvent ? 'Title' : 'New event'}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Time" className="col-span-1">
              <Input type="time" value={time} disabled={allDay} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <div className="col-span-2 flex items-end justify-between gap-3 pb-0.5">
              <div className="flex gap-1.5">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.value}
                    className={clsx(
                      'h-7 w-7 rounded-full transition-all',
                      c.className,
                      color === c.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : 'opacity-50 hover:opacity-80'
                    )}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 pb-1.5 text-xs text-muted">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-border" />
                All day
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {editingEvent ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onRemove(editingEvent.id);
                  onClose();
                }}
                className="text-red-500 hover:text-red-500"
              >
                <Trash2 size={14} /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button onClick={submit} disabled={!title.trim()}>
                {editingEvent ? (
                  <>
                    <Pencil size={14} /> Save changes
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add event
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
