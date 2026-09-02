import { useEffect, useMemo, useState } from 'react';
import { Clock, Copy, LayoutList, Pencil, Plus, Sunrise, Sunset, Trash2, Watch } from 'lucide-react';
import { useSettingsStore, useTimeTableStore } from '@life-manager/core';
import { DAY_NAMES, formatMinutes, minutesBetween, type TimeSlot } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Textarea } from '../components/ui/FormControls';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { TimeTableClock } from '../components/timetable/ClockView';
import { LiveRotatingClock } from '../components/timetable/LiveRotatingClock';
import clsx from 'clsx';

const SLOT_COLORS: { value: string; className: string }[] = [
  { value: 'blue', className: 'bg-accentCalendar' },
  { value: 'violet', className: 'bg-accentGoals' },
  { value: 'amber', className: 'bg-accentTasks' },
  { value: 'emerald', className: 'bg-accentMoney' },
  { value: 'rose', className: 'bg-accentLibrary' },
];

function colorClass(color: string) {
  return SLOT_COLORS.find((c) => c.value === color)?.className ?? 'bg-accentCalendar';
}

type View = 'list' | 'clock';

export function TimeTableScreen() {
  const { schedules, slots, fetchAll, updateSchedule, applyScheduleToDays, addSlot, updateSlot, removeSlot, cloneSlotToDays, loaded } =
    useTimeTableStore();
  const { clockStyle, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay());
  const [view, setView] = useState<View>('list');
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [cloningSlot, setCloningSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    if (!loaded) fetchAll();
    if (!settingsLoaded) loadSettings();
  }, [loaded, fetchAll, settingsLoaded, loadSettings]);

  const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
  const daySlots = useMemo(
    () => slots.filter((s) => s.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, dayOfWeek]
  );

  const awakeMinutes = schedule ? minutesBetween(schedule.wakeTime, schedule.sleepTime) : 0;
  const scheduledMinutes = daySlots.reduce((sum, s) => sum + minutesBetween(s.startTime, s.endTime), 0);
  const pct = awakeMinutes > 0 ? Math.min(100, Math.round((scheduledMinutes / awakeMinutes) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Time Table</h1>
        <p className="mt-1 text-sm text-muted">Your recurring weekly routine — repeats every week, unlike Calendar's dated events.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DAY_NAMES.map((name, i) => (
          <button
            key={name}
            onClick={() => setDayOfWeek(i)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              i === dayOfWeek ? 'bg-primary text-white shadow-sm' : 'bg-surface text-muted hover:text-foreground'
            )}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      {schedule && (
        <Card>
          <CardHeader>
            <CardTitle>Wake & sleep — {DAY_NAMES[dayOfWeek]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <Field label="Wake up">
                <div className="flex items-center gap-2">
                  <Sunrise size={16} className="shrink-0 text-accentTasks" />
                  <Input
                    type="time"
                    value={schedule.wakeTime}
                    onChange={(e) => updateSchedule(dayOfWeek, { wakeTime: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="Sleep">
                <div className="flex items-center gap-2">
                  <Sunset size={16} className="shrink-0 text-accentGoals" />
                  <Input
                    type="time"
                    value={schedule.sleepTime}
                    onChange={(e) => updateSchedule(dayOfWeek, { sleepTime: e.target.value })}
                  />
                </div>
              </Field>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted">
                  <Clock size={14} /> {formatMinutes(scheduledMinutes)} scheduled of {formatMinutes(awakeMinutes)} awake
                </span>
                <span className="text-muted">{pct}%</span>
              </div>
              <ProgressBar value={pct} toneClassName={pct >= 100 ? 'bg-red-500' : 'bg-primary'} />
            </div>

            <Button variant="ghost" size="sm" onClick={() => setApplyDialogOpen(true)}>
              Apply this to other days…
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Schedule — {DAY_NAMES[dayOfWeek]}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
              <button
                onClick={() => setView('list')}
                title="List view"
                className={clsx(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                )}
              >
                <LayoutList size={13} /> List
              </button>
              <button
                onClick={() => setView('clock')}
                title="Clock view"
                className={clsx(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  view === 'clock' ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                )}
              >
                <Watch size={13} /> Clock
              </button>
            </div>
            <Button size="sm" onClick={() => setSlotDialogOpen(true)}>
              <Plus size={14} /> Add slot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {daySlots.length === 0 ? (
            <EmptyState
              icon={<Clock size={24} />}
              title="Nothing scheduled"
              description="Add a time slot for what you want to do during your awake hours."
              action={
                <Button size="sm" onClick={() => setSlotDialogOpen(true)}>
                  <Plus size={14} /> Add slot
                </Button>
              }
            />
          ) : view === 'clock' ? (
            clockStyle === 'liveRotating' ? (
              <LiveRotatingClock schedule={schedule} slots={daySlots} />
            ) : (
              <TimeTableClock schedule={schedule} slots={daySlots} />
            )
          ) : (
            <div className="space-y-1.5">
              {daySlots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5">
                  <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', colorClass(slot.color))} />
                  <span className="w-28 shrink-0 text-xs text-muted">
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{slot.label}</p>
                    {slot.notes && <p className="truncate text-xs text-muted">{slot.notes}</p>}
                  </div>
                  <button onClick={() => setCloningSlot(slot)} title="Clone to other days" className="shrink-0 text-muted hover:text-foreground">
                    <Copy size={13} />
                  </button>
                  <button onClick={() => setEditingSlot(slot)} title="Edit" className="shrink-0 text-muted hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removeSlot(slot.id)} className="shrink-0 text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {schedule && (
        <ApplyToDaysDialog
          open={applyDialogOpen}
          onClose={() => setApplyDialogOpen(false)}
          currentDay={dayOfWeek}
          wakeTime={schedule.wakeTime}
          sleepTime={schedule.sleepTime}
          onApply={(days) => applyScheduleToDays(days, schedule.wakeTime, schedule.sleepTime)}
        />
      )}
      <SlotDialog
        open={slotDialogOpen}
        onClose={() => setSlotDialogOpen(false)}
        onCreate={(startTime, endTime, label, notes, color) => addSlot(dayOfWeek, startTime, endTime, label, notes, color)}
      />
      {editingSlot && (
        <SlotDialog
          open
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onCreate={() => {}}
          onUpdate={(patch) => updateSlot(editingSlot.id, patch)}
        />
      )}
      {cloningSlot && (
        <CloneSlotDialog
          open
          onClose={() => setCloningSlot(null)}
          currentDay={dayOfWeek}
          slotLabel={cloningSlot.label}
          onClone={(days) => cloneSlotToDays(cloningSlot.id, days)}
        />
      )}
    </div>
  );
}

function DayMultiSelect({ currentDay, selected, onToggle }: { currentDay: number; selected: Set<number>; onToggle: (day: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {DAY_NAMES.map((name, i) =>
        i === currentDay ? null : (
          <label key={name} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm">
            <input type="checkbox" checked={selected.has(i)} onChange={() => onToggle(i)} className="h-4 w-4 rounded border-border" />
            {name}
          </label>
        )
      )}
    </div>
  );
}

function ApplyToDaysDialog({
  open,
  onClose,
  currentDay,
  wakeTime,
  sleepTime,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  currentDay: number;
  wakeTime: string;
  sleepTime: string;
  onApply: (days: number[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (day: number) => {
    const next = new Set(selected);
    next.has(day) ? next.delete(day) : next.add(day);
    setSelected(next);
  };

  const submit = () => {
    if (selected.size === 0) return;
    onApply([...selected]);
    setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Apply ${wakeTime}–${sleepTime} to…`}>
      <div className="space-y-3">
        <DayMultiSelect currentDay={currentDay} selected={selected} onToggle={toggle} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            Apply
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CloneSlotDialog({
  open,
  onClose,
  currentDay,
  slotLabel,
  onClone,
}: {
  open: boolean;
  onClose: () => void;
  currentDay: number;
  slotLabel: string;
  onClone: (days: number[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (day: number) => {
    const next = new Set(selected);
    next.has(day) ? next.delete(day) : next.add(day);
    setSelected(next);
  };

  const submit = () => {
    if (selected.size === 0) return;
    onClone([...selected]);
    setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Clone "${slotLabel}" to…`}>
      <div className="space-y-3">
        <DayMultiSelect currentDay={currentDay} selected={selected} onToggle={toggle} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            Clone
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SlotDialog({
  open,
  onClose,
  slot,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  slot?: TimeSlot;
  onCreate: (startTime: string, endTime: string, label: string, notes: string | null, color: string) => void;
  onUpdate?: (patch: { startTime: string; endTime: string; label: string; notes: string | null; color: string }) => void;
}) {
  const isEditing = !!slot;
  const [startTime, setStartTime] = useState(slot?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(slot?.endTime ?? '10:00');
  const [label, setLabel] = useState(slot?.label ?? '');
  const [notes, setNotes] = useState(slot?.notes ?? '');
  const [color, setColor] = useState(slot?.color ?? 'blue');

  const submit = () => {
    if (!label.trim()) return;
    if (isEditing && onUpdate) {
      onUpdate({ startTime, endTime, label: label.trim(), notes: notes.trim() || null, color });
    } else {
      onCreate(startTime, endTime, label.trim(), notes.trim() || null, color);
    }
    setLabel('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? 'Edit time slot' : 'New time slot'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <Field label="What to do">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Deep work: Project X" autoFocus />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Color">
          <div className="flex gap-2">
            {SLOT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={clsx('h-6 w-6 rounded-full', c.className, color === c.value && 'ring-2 ring-offset-2 ring-offset-surface ring-primary')}
                title={c.value}
              />
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!label.trim()}>
            {isEditing ? 'Save changes' : 'Add slot'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
