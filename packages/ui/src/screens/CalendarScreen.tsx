import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCalendarStore } from '@life-manager/core';
import type { CalendarEvent } from '@life-manager/shared';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select } from '../components/ui/FormControls';
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

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarScreen() {
  const { events, fetchEvents, addEvent, removeEvent, loaded } = useCalendarStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!loaded) fetchEvents();
  }, [loaded, fetchEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.startAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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

  const today = toDateKey(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted">Click a day to add or view events.</p>
        </div>
        <div className="flex items-center gap-2">
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(({ date, inMonth }, i) => {
            const key = toDateKey(date);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === today;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={clsx(
                  'flex min-h-[92px] flex-col items-start gap-1 border-b border-r border-border p-2 text-left transition-colors hover:bg-surface',
                  !inMonth && 'text-muted/50',
                  (i + 1) % 7 === 0 && 'border-r-0'
                )}
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday && 'bg-primary text-white font-semibold'
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

      {selectedDate && (
        <DayDialog
          date={selectedDate}
          events={eventsByDay.get(toDateKey(selectedDate)) ?? []}
          onClose={() => setSelectedDate(null)}
          onAdd={addEvent}
          onRemove={removeEvent}
        />
      )}
    </div>
  );
}

function DayDialog({
  date,
  events,
  onClose,
  onAdd,
  onRemove,
}: {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onAdd: ReturnType<typeof useCalendarStore.getState>['addEvent'];
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('blue');

  const submit = async () => {
    if (!title.trim()) return;
    const startAt = allDay
      ? date.toISOString().slice(0, 10)
      : new Date(`${date.toISOString().slice(0, 10)}T${time}`).toISOString();
    await onAdd({ title: title.trim(), startAt, allDay, color });
    setTitle('');
  };

  return (
    <Dialog open onClose={onClose} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          {events.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-sm">
              <span className={clsx('h-2 w-2 shrink-0 rounded-full', colorClass(e.color))} />
              <span className="flex-1">{e.title}</span>
              {!e.allDay && <span className="text-xs text-muted">{e.startAt.slice(11, 16)}</span>}
              <button onClick={() => onRemove(e.id)} className="text-muted hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <Field label="New event">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Time" className="col-span-1">
              <Input type="time" value={time} disabled={allDay} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Color" className="col-span-1">
              <Select value={color} onChange={(e) => setColor(e.target.value)}>
                {EVENT_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="col-span-1 flex items-end gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-border" />
              All day
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={submit} disabled={!title.trim()}>
              <Plus size={14} /> Add event
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
