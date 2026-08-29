import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Apple,
  CalendarHeart,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { useHealthStore, useSettingsStore } from '@life-manager/core';
import { DAY_NAMES, formatCurrency, formatDate, type ExerciseCategory } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import clsx from 'clsx';

type Tab = 'exercise' | 'doctor' | 'food' | 'metrics';

const TAB_META: Record<Tab, { label: string; icon: typeof Dumbbell }> = {
  exercise: { label: 'Exercise Schedule', icon: Dumbbell },
  doctor: { label: 'Doctor Appointments', icon: Stethoscope },
  food: { label: 'Food & Nutrition', icon: Apple },
  metrics: { label: 'Body Metrics', icon: Scale },
};

const CATEGORY_ICON: Record<ExerciseCategory, typeof Dumbbell> = {
  strength: Dumbbell,
  cardio: Flame,
  flexibility: Activity,
  other: Activity,
};

export function HealthScreen() {
  const { exercises, appointments, foods, metrics, fetchAll, loaded } = useHealthStore();
  const currency = useSettingsStore((s) => s.currency);
  const [tab, setTab] = useState<Tab>('exercise');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loaded) fetchAll();
  }, [loaded, fetchAll]);

  const today = new Date().getDay();
  const todaysExercises = useMemo(
    () => exercises.filter((e) => e.daysOfWeek.split(',').map(Number).includes(today)),
    [exercises, today]
  );
  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.appointmentAt).getTime() >= Date.now())
        .sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt))[0],
    [appointments]
  );
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const foodsThisWeek = useMemo(() => foods.filter((f) => new Date(f.createdAt).getTime() >= weekAgo), [foods, weekAgo]);
  const latestMetric = useMemo(
    () => [...metrics].sort((a, b) => b.date.localeCompare(a.date))[0],
    [metrics]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
          <p className="mt-1 text-sm text-muted">Exercise, appointments, nutrition, and body metrics — all in one place.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          {tab === 'exercise' && 'New exercise'}
          {tab === 'doctor' && 'New appointment'}
          {tab === 'food' && 'Log food'}
          {tab === 'metrics' && 'Log weight'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <OverviewCard
          icon={<Dumbbell size={16} />}
          accent="text-accentHealth bg-accentHealth/10"
          label="Today's exercises"
          value={String(todaysExercises.length)}
          sub={todaysExercises[0]?.name ?? 'Nothing scheduled'}
          onClick={() => setTab('exercise')}
        />
        <OverviewCard
          icon={<Stethoscope size={16} />}
          accent="text-accentCalendar bg-accentCalendar/10"
          label="Next appointment"
          value={nextAppointment ? formatDate(nextAppointment.appointmentAt) : 'None'}
          sub={nextAppointment?.doctorName ?? 'Nothing planned'}
          onClick={() => setTab('doctor')}
        />
        <OverviewCard
          icon={<Apple size={16} />}
          accent="text-accentMoney bg-accentMoney/10"
          label="Foods logged this week"
          value={String(foodsThisWeek.length)}
          sub={`${foods.length} all-time`}
          onClick={() => setTab('food')}
        />
        <OverviewCard
          icon={<Scale size={16} />}
          accent="text-accentTasks bg-accentTasks/10"
          label="Latest weight"
          value={latestMetric ? `${latestMetric.weight} ${latestMetric.unit}` : 'None'}
          sub={latestMetric ? formatDate(latestMetric.date) : 'Log your first entry'}
          onClick={() => setTab('metrics')}
        />
      </div>

      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
        {(Object.keys(TAB_META) as Tab[]).map((t) => {
          const { label, icon: Icon } = TAB_META[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-surface text-accentHealth shadow-sm' : 'text-muted hover:text-foreground'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'exercise' && <ExerciseTab onEmptyAdd={() => setDialogOpen(true)} />}
      {tab === 'doctor' && <DoctorTab onEmptyAdd={() => setDialogOpen(true)} />}
      {tab === 'food' && <FoodTab onEmptyAdd={() => setDialogOpen(true)} currency={currency} />}
      {tab === 'metrics' && <MetricsTab onEmptyAdd={() => setDialogOpen(true)} />}

      {tab === 'exercise' && <NewExerciseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
      {tab === 'doctor' && <NewAppointmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
      {tab === 'food' && <NewFoodDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
      {tab === 'metrics' && <NewMetricDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

function OverviewCard({
  icon,
  accent,
  label,
  value,
  sub,
  onClick,
}: {
  icon: ReactNode;
  accent: string;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <Card onClick={onClick} className="cursor-pointer p-5 transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </Card>
  );
}

// --- Exercise Schedule -------------------------------------------------------

function ExerciseTab({ onEmptyAdd }: { onEmptyAdd: () => void }) {
  const { exercises, removeExercise } = useHealthStore();
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay());

  const dayExercises = exercises.filter((e) => e.daysOfWeek.split(',').map(Number).includes(dayOfWeek));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {DAY_NAMES.map((name, i) => (
          <button
            key={name}
            onClick={() => setDayOfWeek(i)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              i === dayOfWeek ? 'bg-accentHealth text-white shadow-sm' : 'bg-surface text-muted hover:text-foreground'
            )}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{DAY_NAMES[dayOfWeek]}'s exercises</CardTitle>
        </CardHeader>
        <CardContent>
          {dayExercises.length === 0 ? (
            <EmptyState
              icon={<Dumbbell size={24} />}
              title="Rest day, or nothing scheduled yet"
              description="Add an exercise and assign it to the days you want to repeat it on."
              action={
                <Button size="sm" onClick={onEmptyAdd}>
                  <Plus size={14} /> New exercise
                </Button>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {dayExercises.map((exercise) => {
                const Icon = CATEGORY_ICON[exercise.category];
                return (
                  <div key={exercise.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accentHealth/10 text-accentHealth">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{exercise.name}</p>
                      <p className="truncate text-xs capitalize text-muted">
                        {exercise.category}
                        {exercise.durationMinutes ? ` · ${exercise.durationMinutes} min` : ''}
                        {exercise.sets && exercise.reps ? ` · ${exercise.sets}×${exercise.reps}` : ''}
                        {exercise.notes ? ` · ${exercise.notes}` : ''}
                      </p>
                    </div>
                    <button onClick={() => removeExercise(exercise.id)} className="shrink-0 text-muted hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All exercises</CardTitle>
        </CardHeader>
        <CardContent>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted">None added yet.</p>
          ) : (
            <div className="space-y-1.5">
              {exercises.map((exercise) => (
                <div key={exercise.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{exercise.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {exercise.daysOfWeek
                      .split(',')
                      .map((d) => DAY_NAMES[Number(d)]?.slice(0, 3))
                      .join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewExerciseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addExercise } = useHealthStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [days, setDays] = useState<Set<number>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [notes, setNotes] = useState('');

  const toggleDay = (d: number) => {
    const next = new Set(days);
    next.has(d) ? next.delete(d) : next.add(d);
    setDays(next);
  };

  const submit = async () => {
    if (!name.trim() || days.size === 0) return;
    await addExercise({
      name: name.trim(),
      category,
      daysOfWeek: [...days].sort().join(','),
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      sets: sets ? Number(sets) : null,
      reps: reps ? Number(reps) : null,
      notes: notes.trim() || null,
    });
    setName('');
    setDays(new Set());
    setDurationMinutes('');
    setSets('');
    setReps('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New exercise">
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push-ups" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="flexibility">Flexibility</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Repeats on">
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  days.has(i) ? 'bg-accentHealth text-white' : 'bg-background text-muted hover:text-foreground'
                )}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Duration (min)">
            <Input type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
          </Field>
          <Field label="Sets">
            <Input type="number" min={0} value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <Field label="Reps">
            <Input type="number" min={0} value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || days.size === 0}>
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// --- Doctor Appointments -----------------------------------------------------

function DoctorTab({ onEmptyAdd }: { onEmptyAdd: () => void }) {
  const { appointments, removeAppointment } = useHealthStore();
  const sorted = [...appointments].sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  const now = Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Stethoscope size={24} />}
            title="No appointments"
            description="Add an upcoming visit or a planned checkup."
            action={
              <Button size="sm" onClick={onEmptyAdd}>
                <Plus size={14} /> New appointment
              </Button>
            }
          />
        ) : (
          <div className="space-y-1.5">
            {sorted.map((appt) => {
              const isPast = new Date(appt.appointmentAt).getTime() < now;
              return (
                <div
                  key={appt.id}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5',
                    isPast ? 'bg-background opacity-60' : 'bg-accentHealth/5'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      isPast ? 'bg-muted/10 text-muted' : 'bg-accentHealth/10 text-accentHealth'
                    )}
                  >
                    <CalendarHeart size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {appt.doctorName}
                      {appt.specialty ? ` · ${appt.specialty}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {new Date(appt.appointmentAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {appt.reason ? ` · ${appt.reason}` : ''}
                    </p>
                  </div>
                  {isPast && <Badge tone="default">Past</Badge>}
                  <button onClick={() => removeAppointment(appt.id)} className="shrink-0 text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewAppointmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAppointment } = useHealthStore();
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [appointmentAt, setAppointmentAt] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!doctorName.trim() || !appointmentAt) return;
    await addAppointment({
      doctorName: doctorName.trim(),
      specialty: specialty.trim() || null,
      appointmentAt: new Date(appointmentAt).toISOString(),
      reason: reason.trim() || null,
      notes: notes.trim() || null,
    });
    setDoctorName('');
    setSpecialty('');
    setAppointmentAt('');
    setReason('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New doctor appointment">
      <div className="space-y-3">
        <Field label="Doctor name">
          <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="e.g. Dr. Ahmed" autoFocus />
        </Field>
        <Field label="Specialty (optional)">
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Dentist" />
        </Field>
        <Field label="Date & time">
          <Input type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
        </Field>
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual checkup" />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!doctorName.trim() || !appointmentAt}>
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// --- Food & Nutrition ---------------------------------------------------------

function FoodTab({ onEmptyAdd, currency }: { onEmptyAdd: () => void; currency: string }) {
  const { foods, pendingFoodIds, removeFood } = useHealthStore();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {foods.length === 0 ? (
        <div className="md:col-span-2">
          <Card>
            <CardContent>
              <EmptyState
                icon={<Apple size={24} />}
                title="Nothing logged yet"
                description="Add a food with its quantity and price — AI fills in benefits, calories, and considerations automatically."
                action={
                  <Button size="sm" onClick={onEmptyAdd}>
                    <Plus size={14} /> Log food
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        foods.map((food) => (
          <Card key={food.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{food.name}</p>
                <p className="text-xs text-muted">
                  {food.quantity}
                  {food.price != null ? ` · ${formatCurrency(food.price, currency)}` : ''}
                </p>
              </div>
              <button onClick={() => removeFood(food.id)} className="shrink-0 text-muted hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>

            {pendingFoodIds.has(food.id) ? (
              <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2.5 text-sm text-muted">
                <Sparkles size={14} className="animate-pulse text-accentHealth" />
                Getting nutrition info…
              </div>
            ) : food.benefits ? (
              <div className="space-y-2 rounded-lg bg-background p-3 text-xs">
                {food.caloriesEstimate && (
                  <div className="flex items-center gap-1.5">
                    <Flame size={13} className="shrink-0 text-accentTasks" />
                    <span className="font-medium text-foreground/90">{food.caloriesEstimate}</span>
                  </div>
                )}
                <p className="leading-relaxed text-foreground/90">{food.benefits}</p>
                {food.considerations && food.considerations !== 'None notable' && (
                  <p className="leading-relaxed text-muted">⚠ {food.considerations}</p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
                No AI info — configure a provider in Settings.
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function NewFoodDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addFood } = useHealthStore();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !quantity.trim()) return;
    setSubmitting(true);
    await addFood(name.trim(), quantity.trim(), price ? Number(price) : null);
    setSubmitting(false);
    setName('');
    setQuantity('');
    setPrice('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Log food">
      <div className="space-y-3">
        <Field label="Food name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grilled chicken breast" autoFocus />
        </Field>
        <Field label="Quantity">
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 200g" />
        </Field>
        <Field label="Price (optional)">
          <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">
          Benefits, a calorie estimate, and any considerations generate automatically after you add it.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !quantity.trim() || submitting}>
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// --- Body Metrics --------------------------------------------------------------

function MetricsTab({ onEmptyAdd }: { onEmptyAdd: () => void }) {
  const { metrics, removeMetric } = useHealthStore();
  const sorted = [...metrics].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight log</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Scale size={24} />}
            title="No entries yet"
            description="Log your weight to track trends over time."
            action={
              <Button size="sm" onClick={onEmptyAdd}>
                <Plus size={14} /> Log weight
              </Button>
            }
          />
        ) : (
          <div className="space-y-1.5">
            {sorted.map((metric, i) => {
              const prev = sorted[i + 1];
              const delta = prev ? metric.weight - prev.weight : null;
              return (
                <div key={metric.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accentHealth/10 text-accentHealth">
                    <Scale size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {metric.weight} {metric.unit}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(metric.date)}
                      {metric.notes ? ` · ${metric.notes}` : ''}
                    </p>
                  </div>
                  {delta != null && Math.abs(delta) > 0.001 && (
                    <span
                      className={clsx(
                        'flex shrink-0 items-center gap-1 text-xs font-medium',
                        delta < 0 ? 'text-emerald-500' : 'text-red-500'
                      )}
                    >
                      {delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                      {Math.abs(delta).toFixed(1)}
                    </span>
                  )}
                  <button onClick={() => removeMetric(metric.id)} className="shrink-0 text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewMetricDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addMetric } = useHealthStore();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!weight) return;
    await addMetric(date, Number(weight), unit, notes.trim() || null);
    setWeight('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Log weight">
      <div className="space-y-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight">
            <Input type="number" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus />
          </Field>
          <Field label="Unit">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!weight}>
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
