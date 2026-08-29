import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, CheckSquare, Clock, Quote as QuoteIcon, Shuffle, Target, Wallet } from 'lucide-react';
import {
  useCalendarStore,
  useGoalsStore,
  useMoneyStore,
  useQuotesStore,
  useSettingsStore,
  useTasksStore,
  useTimeTableStore,
  computeTotalSavings,
  pickRandomQuote,
} from '@life-manager/core';
import { DAY_NAMES, formatCurrency, formatDate, formatMinutes, isSameMonth, minutesBetween } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import type { ScreenId } from '../navigation';

const greetingFor = (hour: number) => {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export function DashboardScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { goals, fetchGoals, loaded: goalsLoaded } = useGoalsStore();
  const { tasks, fetchTasks, loaded: tasksLoaded } = useTasksStore();
  const { events, fetchEvents, loaded: eventsLoaded } = useCalendarStore();
  const { entries: savingsEntries, fetchAll, loaded: moneyLoaded } = useMoneyStore();
  const { quotes, fetchQuotes, loaded: quotesLoaded } = useQuotesStore();
  const { currency: defaultCurrency, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();
  const { schedules, slots, fetchAll: fetchTimeTable, loaded: timeTableLoaded } = useTimeTableStore();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (!goalsLoaded) fetchGoals();
    if (!tasksLoaded) fetchTasks();
    if (!eventsLoaded) fetchEvents();
    if (!moneyLoaded) fetchAll();
    if (!quotesLoaded) fetchQuotes();
    if (!settingsLoaded) loadSettings();
    if (!timeTableLoaded) fetchTimeTable();
    setQuoteIndex(Math.floor(Math.random() * 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuote = useMemo(
    () => (quotes.length ? quotes[quoteIndex % quotes.length] : pickRandomQuote(quotes)),
    [quotes, quoteIndex]
  );

  const today = new Date();

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const avgProgress = useMemo(
    () => (activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progressPct, 0) / activeGoals.length) : 0),
    [activeGoals]
  );

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const dueTodayTasks = useMemo(
    () =>
      openTasks.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d.toDateString() === today.toDateString() || d < today;
      }),
    [openTasks]
  );

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.startAt) >= new Date(today.toDateString()))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 3),
    [events]
  );

  const netThisMonth = useMemo(() => {
    return savingsEntries
      .filter((e) => isSameMonth(e.date, today))
      .reduce((sum, e) => sum + (e.type === 'expense' ? -e.amount : e.amount), 0);
  }, [savingsEntries]);

  const totalSavings = useMemo(() => computeTotalSavings(savingsEntries), [savingsEntries]);

  const todayDayOfWeek = today.getDay();
  const todaySchedule = useMemo(() => schedules.find((s) => s.dayOfWeek === todayDayOfWeek), [schedules, todayDayOfWeek]);
  const todaySlots = useMemo(
    () =>
      slots
        .filter((s) => s.dayOfWeek === todayDayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, todayDayOfWeek]
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">
          {greetingFor(today.getHours())} — {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Here's where things stand.</h1>
      </div>

      {currentQuote && (
        <Card className="flex items-start gap-3 border-none bg-gradient-to-br from-accentLibrary/10 via-surface to-surface p-5">
          <QuoteIcon size={18} className="mt-0.5 shrink-0 text-accentLibrary" />
          <div className="flex-1">
            <p className="text-sm italic leading-relaxed text-foreground/90">"{currentQuote.text}"</p>
            {currentQuote.author && <p className="mt-1.5 text-xs text-muted">— {currentQuote.author}</p>}
          </div>
          {quotes.length > 1 && (
            <button
              onClick={() => setQuoteIndex((i) => i + 1)}
              title="Show another quote"
              className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              <Shuffle size={14} />
            </button>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Target size={16} />}
          accent="text-accentGoals bg-accentGoals/10"
          label="Active goals"
          value={String(activeGoals.length)}
          sub={activeGoals.length ? `${avgProgress}% avg. progress` : 'None yet'}
          onClick={() => onNavigate('goals')}
        />
        <StatCard
          icon={<CheckSquare size={16} />}
          accent="text-accentTasks bg-accentTasks/10"
          label="Due today / overdue"
          value={String(dueTodayTasks.length)}
          sub={`${openTasks.length} open total`}
          onClick={() => onNavigate('tasks')}
        />
        <StatCard
          icon={<CalendarDays size={16} />}
          accent="text-accentCalendar bg-accentCalendar/10"
          label="Upcoming events"
          value={String(upcomingEvents.length)}
          sub={upcomingEvents[0] ? formatDate(upcomingEvents[0].startAt) : 'Nothing scheduled'}
          onClick={() => onNavigate('calendar')}
        />
        <StatCard
          icon={<Wallet size={16} />}
          accent="text-accentMoney bg-accentMoney/10"
          label="Total savings"
          value={formatCurrency(totalSavings, defaultCurrency)}
          sub={`${netThisMonth >= 0 ? '+' : ''}${formatCurrency(netThisMonth, defaultCurrency)} this month`}
          onClick={() => onNavigate('money')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goals in motion</CardTitle>
            <Badge tone="goals">{activeGoals.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeGoals.length === 0 ? (
              <EmptyState title="No active goals yet" description="Set your first target to see progress here." />
            ) : (
              activeGoals.slice(0, 4).map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-muted">{g.progressPct}%</span>
                  </div>
                  <ProgressBar value={g.progressPct} toneClassName="bg-accentGoals" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What's next</CardTitle>
            <Badge tone="calendar">{upcomingEvents.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <EmptyState title="Nothing on the calendar" description="Add an event to plan ahead." />
            ) : (
              upcomingEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-accentCalendar" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted">{formatDate(e.startAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <CalendarClock size={15} className="text-accentCalendar" />
            Today's Time Table — {DAY_NAMES[todayDayOfWeek]}
          </CardTitle>
          <button onClick={() => onNavigate('timeTable')} className="text-xs font-medium text-accentCalendar hover:underline">
            Full Time Table →
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaySchedule && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Clock size={12} />
              Awake {todaySchedule.wakeTime}–{todaySchedule.sleepTime} ({formatMinutes(minutesBetween(todaySchedule.wakeTime, todaySchedule.sleepTime))})
            </p>
          )}
          {todaySlots.length === 0 ? (
            <EmptyState title="Nothing scheduled today" description="Add time slots in Time Table to see today's plan here." />
          ) : (
            <div className="space-y-1.5">
              {todaySlots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5">
                  <span className="w-24 shrink-0 text-xs text-muted">
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{slot.label}</p>
                    {slot.notes && <p className="truncate text-xs text-muted">{slot.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
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
    <Card
      onClick={onClick}
      className="cursor-pointer p-5 transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </Card>
  );
}
