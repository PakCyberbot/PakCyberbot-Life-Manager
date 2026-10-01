import { useEffect, useMemo, useState } from 'react';
import { LayoutList, Quote as QuoteIcon, Shuffle, Watch } from 'lucide-react';
import {
  useCalendarStore,
  useGoalsStore,
  useMoneyStore,
  useQuotesStore,
  useSettingsStore,
  useTimeTableStore,
  computeTotalSavings,
  pickRandomQuote,
} from '@life-manager/core';
import { DAY_NAMES, formatCurrency, formatDate, isSameMonth } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle, Badge, ProgressBar, TimeTableClock, LiveRotatingClock, QuoteText } from '@life-manager/ui';
import type { MobileScreenId } from '../navigation';
import clsx from 'clsx';

const greetingFor = (hour: number) => {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Same data Dashboard shows on desktop (goals, events, savings, quotes),
// plus today's Time Table rendered as the Clock view instead of a plain
// list — per the user's own ask for mobile's dashboard.
export function MobileDashboardScreen({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { goals, fetchGoals, loaded: goalsLoaded } = useGoalsStore();
  const { events, fetchEvents, loaded: eventsLoaded } = useCalendarStore();
  const { entries: savingsEntries, fetchAll: fetchMoney, loaded: moneyLoaded } = useMoneyStore();
  const { quotes, fetchQuotes, loaded: quotesLoaded } = useQuotesStore();
  const {
    currency,
    clockStyle,
    clockTimeFormat,
    dashboardTimeTableView,
    setDashboardTimeTableView,
    loaded: settingsLoaded,
    load: loadSettings,
  } = useSettingsStore();
  const { schedules, slots, fetchAll: fetchTimeTable, loaded: timeTableLoaded } = useTimeTableStore();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (!goalsLoaded) fetchGoals();
    if (!eventsLoaded) fetchEvents();
    if (!moneyLoaded) fetchMoney();
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
  const todayDayOfWeek = today.getDay();

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.startAt) >= new Date(today.toDateString()))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 3),
    [events]
  );
  const netThisMonth = useMemo(
    () => savingsEntries.filter((e) => isSameMonth(e.date, today)).reduce((sum, e) => sum + (e.type === 'expense' ? -e.amount : e.amount), 0),
    [savingsEntries]
  );
  const totalSavings = useMemo(() => computeTotalSavings(savingsEntries), [savingsEntries]);
  const todaySchedule = useMemo(() => schedules.find((s) => s.dayOfWeek === todayDayOfWeek), [schedules, todayDayOfWeek]);
  const todaySlots = useMemo(
    () => slots.filter((s) => s.dayOfWeek === todayDayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, todayDayOfWeek]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          {greetingFor(today.getHours())} — {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Here's where things stand.</h1>
      </div>

      {currentQuote && (
        <Card className="flex items-start gap-3 border-none bg-gradient-to-br from-accentLibrary/10 via-surface to-surface p-4">
          <QuoteIcon size={16} className="mt-0.5 shrink-0 text-accentLibrary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1 text-sm italic leading-relaxed text-foreground/90">
              <span className="shrink-0">"</span>
              <div className="min-w-0 flex-1">
                <QuoteText text={currentQuote.text} className="text-sm italic leading-relaxed text-foreground/90" />
              </div>
              <span className="shrink-0">"</span>
            </div>
            {currentQuote.author && <p className="mt-1.5 text-xs text-muted">— {currentQuote.author}</p>}
          </div>
          {quotes.length > 1 && (
            <button onClick={() => setQuoteIndex((i) => i + 1)} className="shrink-0 rounded-lg p-1.5 text-muted active:bg-background">
              <Shuffle size={14} />
            </button>
          )}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <StatChip label="Goals" value={String(activeGoals.length)} onClick={() => onNavigate('goals')} />
        <StatChip label="Events" value={String(upcomingEvents.length)} onClick={() => onNavigate('calendar')} />
        <StatChip label="Savings" value={formatCurrency(totalSavings, currency)} small onClick={() => onNavigate('money')} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Goals in motion</CardTitle>
          <Badge tone="goals">{activeGoals.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeGoals.length === 0 ? (
            <p className="text-xs text-muted">No active goals yet.</p>
          ) : (
            activeGoals.slice(0, 3).map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{g.title}</span>
                  <span className="shrink-0 text-muted">{g.progressPct}%</span>
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
        <CardContent className="space-y-2">
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-muted">Nothing on the calendar.</p>
          ) : (
            upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-2">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-accentCalendar" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted">{formatDate(e.startAt)}</p>
                </div>
              </div>
            ))
          )}
          {netThisMonth !== 0 && (
            <p className="pt-1 text-xs text-muted">
              {netThisMonth >= 0 ? '+' : ''}
              {formatCurrency(netThisMonth, currency)} this month
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Time Table — {DAY_NAMES[todayDayOfWeek]}</CardTitle>
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => setDashboardTimeTableView('list')}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                dashboardTimeTableView === 'list' ? 'bg-surface text-foreground shadow-sm' : 'text-muted'
              )}
            >
              <LayoutList size={12} />
            </button>
            <button
              onClick={() => setDashboardTimeTableView('clock')}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                dashboardTimeTableView === 'clock' ? 'bg-surface text-foreground shadow-sm' : 'text-muted'
              )}
            >
              <Watch size={12} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {todaySlots.length === 0 ? (
            <p className="text-xs text-muted">Nothing scheduled today.</p>
          ) : dashboardTimeTableView === 'clock' ? (
            clockStyle === 'liveRotating' ? (
              <LiveRotatingClock schedule={todaySchedule} slots={todaySlots} timeFormat={clockTimeFormat} />
            ) : (
              <TimeTableClock schedule={todaySchedule} slots={todaySlots} />
            )
          ) : (
            <div className="space-y-1.5">
              {todaySlots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2">
                  <span className="w-20 shrink-0 text-xs text-muted">
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

function StatChip({ label, value, small, onClick }: { label: string; value: string; small?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-border bg-surface p-3 text-left active:bg-background">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={small ? 'mt-0.5 truncate text-sm font-semibold' : 'mt-0.5 text-lg font-semibold'}>{value}</p>
    </button>
  );
}
