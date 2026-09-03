import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { formatMinutes, type DaySchedule, type TimeSlot } from '@life-manager/shared';
import clsx from 'clsx';

// A single live 12-hour analog face, distinct from ClockView.tsx's two-face
// slot-coverage design: one continuously-sweeping hour hand tracking real
// system time, and — the creative twist — each of the 12 dial positions
// doesn't mean a fixed AM or PM hour the way a normal clock's numbers do.
// Instead each position's label always names whichever occurrence (AM or
// PM) of that hour is coming up *next*: at 7:00:00 the "7" position still
// reads AM (the AM occurrence just happened, hasn't been "passed" yet); the
// instant the hand moves past it, it flips to PM (12 hours off is now the
// next 7 o'clock), and flips back the moment the hand passes 7 PM. This
// holds independently for all 12 positions — see computePositions below.
//
// Slot coverage is drawn the same way ClockView.tsx draws its two rings,
// just projected onto this one live dial: at any ring position, the color
// shown is whichever slot covers that position's *currently effective*
// hour — the same AM/PM-flipping hour the printed number there is showing.
// The whole face also acts like a forward-looking spotlight: one continuous
// brightness ramp sweeps all the way around the dial, brightest exactly at
// the hand's current position, dimming smoothly hour by hour through every
// upcoming position (soonest next hour brightest, further-out hours a
// little dimmer each), and bottoming out at the position the hand just
// passed — not a flat "ahead = 100%, behind = dim" split, a genuine single
// ramp with the peak and the floor sitting right next to each other at the
// hand. Recomputes every tick, so it visibly rotates with the hand rather
// than jumping in discrete hourly steps. Below the face, an "Up next"
// stack lists the slots still to come today soonest-first, with a live
// countdown.

const SIZE = 280;
const CENTER = SIZE / 2;
const FACE_RADIUS = 112;
const RING_OUTER = 103;
const RING_WIDTH = 14;
const RING_INNER = RING_OUTER - RING_WIDTH;
const HAND_LENGTH = 82;
// Sampled as many thin radial slivers rather than exact arc paths — the ring's "which hour is
// currently effective" mapping flips at a point that moves continuously with the hand (see
// effectiveHourAt below), so finding exact arc-segment boundaries analytically would need tracking
// that moving flip point *and* every slot/sleep boundary at once. Sampling finely (1.5° apart, well
// below what the eye can resolve as separate slivers on a 280px face) gets the same visual result
// with far less to get subtly wrong — same "verify, don't over-engineer" bias as this file's own
// verification script for the harder ring case had.
const RING_SAMPLES = 240;
/** Floor of the forward-spotlight fade — see dimOpacityAt below. */
const PAST_FLOOR_OPACITY = 0.1;
const TRANSITION = { transition: 'opacity 300ms ease' };

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

function toDecimalHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

const SLOT_COLOR_VARS: Record<string, string> = {
  blue: '--color-accent-calendar',
  violet: '--color-accent-goals',
  amber: '--color-accent-tasks',
  emerald: '--color-accent-money',
  rose: '--color-accent-library',
};

function colorValue(color: string): string {
  return `rgb(var(${SLOT_COLOR_VARS[color] ?? '--color-accent-calendar'}))`;
}

interface DialPosition {
  label: number; // 1–12, the number printed on the dial
  angle: number; // degrees, 0 = 12 o'clock, clockwise
  isPM: boolean;
  dim: number; // 0.3–1, see dimOpacityAt
}

/** Continuous forward-spotlight opacity for dial position `p` (0, 12]: a single ramp all the way
 * around the dial, not split into an "ahead = flat full brightness" zone plus a fade only behind the
 * hand — brightest exactly where the hand is *right now*, then dimming smoothly hour by hour through
 * every *upcoming* position (soonest next hour brightest of the rest, then the one after that a
 * little dimmer, and so on all the way around), bottoming out at PAST_FLOOR_OPACITY on the position
 * immediately *behind* the hand — the one it just passed, which is the farthest point away in the
 * forward direction the spotlight is sweeping (it'll take nearly a full 12h revolution to light back
 * up). `distance` is how far ahead (clockwise, in hours) `p` sits from the hand, wrapping a position
 * that's actually behind the hand around to just under 12 rather than treating it as "already lit."
 * Recomputed every tick (the hand moves continuously), so the whole ramp visibly rotates with it. */
function dimOpacityAt(p: number, decimalHours: number): number {
  const handP = decimalHours % 12;
  let distance = p - handP;
  if (distance < 0) distance += 12; // p sits behind the hand — wrap to its forward (long way round) distance
  const fraction = distance / 12; // [0, 1)
  return 1 - fraction * (1 - PAST_FLOOR_OPACITY);
}

/** For dial position `label` (1–12), its AM occurrence is hour `hourAM` (24h) and its PM occurrence
 * is `hourAM + 12` — always 12 apart within the same 0–24 day, so no modulo wraparound is needed. The
 * label reads PM for the open-closed window (hourAM, hourAM+12] and AM otherwise: at the AM instant
 * itself it still reads AM (matches what just happened), flips to PM the moment time moves past it,
 * and symmetrically flips back to AM the moment time moves past the PM instant — verified against the
 * spec's own worked example (7:00:00 AM still reads AM; just after, reads PM; just after 7:00:00 PM,
 * reads AM again) before wiring this into the render below. */
function isPmForLabel(label: number, decimalHours: number): boolean {
  const hourAM = label === 12 ? 0 : label;
  const hourPM = hourAM + 12;
  return decimalHours > hourAM && decimalHours <= hourPM;
}

function computePositions(decimalHours: number): DialPosition[] {
  return Array.from({ length: 12 }, (_, i) => {
    const label = i === 0 ? 12 : i;
    const p = i === 0 ? 12 : i;
    return { label, angle: i * 30, isPM: isPmForLabel(label, decimalHours), dim: dimOpacityAt(p, decimalHours) };
  });
}

/** The real 24h hour a continuous dial position `p` (0, 12] — same domain as a label, just not
 * restricted to integers — is currently showing, per the exact same flip rule as isPmForLabel. A
 * first attempt at this used `p` itself in the AM/PM comparison for every position, which is wrong
 * for the p=12 case specifically (its AM occurrence is hour 0, not hour 12) — caught by a standalone
 * script sweeping decimalHours across a full day at p=12 and finding it never flipped to PM at all
 * around midday, before this was wired into the component. */
function effectiveHourAt(p: number, decimalHours: number): number {
  const hourAM = p === 12 ? 0 : p;
  const hourPM = hourAM + 12;
  const isPM = decimalHours > hourAM && decimalHours <= hourPM;
  return isPM ? hourPM : hourAM;
}

/** Whichever slot (or the asleep window) covers `hour` — checking `hour` and `hour + 24` against
 * each range covers an overnight-wrapped slot/sleep window without needing ClockView.tsx's arc-
 * splitting machinery, since here we're only ever testing a single point, not building a path. */
function colorForHour(hour: number, slots: TimeSlot[], schedule: DaySchedule | undefined): { color: string; opacity: number } | null {
  for (const slot of slots) {
    const startDec = toDecimalHours(slot.startTime);
    let endDec = toDecimalHours(slot.endTime);
    if (endDec <= startDec) endDec += 24;
    if ((hour >= startDec && hour < endDec) || (hour + 24 >= startDec && hour + 24 < endDec)) {
      return { color: colorValue(slot.color), opacity: 1 };
    }
  }
  if (schedule) {
    const sleepDec = toDecimalHours(schedule.sleepTime);
    let wakeDec = toDecimalHours(schedule.wakeTime);
    if (wakeDec <= sleepDec) wakeDec += 24;
    if ((hour >= sleepDec && hour < wakeDec) || (hour + 24 >= sleepDec && hour + 24 < wakeDec)) {
      return { color: 'rgb(var(--color-muted))', opacity: 0.25 };
    }
  }
  return null;
}

export function LiveRotatingClock({
  schedule,
  slots,
  timeFormat = '12h',
}: {
  schedule: DaySchedule | undefined;
  slots: TimeSlot[];
  /** '12h' (default): dial positions flip their AM/PM label as the hand sweeps past, plus the
   * AM/PM badge pair below the face. '24h' (military): each dial position shows its plain
   * 2-digit effective hour (00–23, reusing the exact same flip instant as '12h' — only what's
   * rendered changes, not when it changes) and the badge pair + digital readout's AM/PM suffix
   * are dropped entirely, per the explicit ask that "AM/PM isn't needed at all" in this mode. */
  timeFormat?: '12h' | '24h';
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const decimalHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const handAngle = ((decimalHours % 12) / 12) * 360;
  const handTip = polarToCartesian(HAND_LENGTH, handAngle);
  const positions = computePositions(decimalHours);
  const isCurrentlyPM = now.getHours() >= 12;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="none" stroke="rgb(var(--color-border))" strokeWidth={2} />
          {/* base ring track, then occupied slivers layer on top, dimmed behind the hand */}
          <circle cx={CENTER} cy={CENTER} r={RING_OUTER - RING_WIDTH / 2} fill="none" stroke="rgb(var(--color-border))" strokeWidth={RING_WIDTH} />
          {Array.from({ length: RING_SAMPLES }).map((_, i) => {
            const angle = (360 / RING_SAMPLES) * i;
            const p = angle === 0 ? 12 : angle / 30;
            const hit = colorForHour(effectiveHourAt(p, decimalHours), slots, schedule);
            if (!hit) return null;
            const outer = polarToCartesian(RING_OUTER, angle);
            const inner = polarToCartesian(RING_INNER, angle);
            const dim = dimOpacityAt(p, decimalHours);
            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={hit.color}
                strokeOpacity={hit.opacity * dim}
                strokeWidth={(360 / RING_SAMPLES) * 3.2}
                style={TRANSITION}
              />
            );
          })}

          {/* minute ticks, every 6°, hour ticks a little longer/bolder, also dimmed behind the hand */}
          {Array.from({ length: 60 }).map((_, i) => {
            const isHourTick = i % 5 === 0;
            const angle = i * 6;
            const p = angle === 0 ? 12 : angle / 30;
            const outer = polarToCartesian(FACE_RADIUS, angle);
            const inner = polarToCartesian(FACE_RADIUS - (isHourTick ? 8 : 4), angle);
            const dim = dimOpacityAt(p, decimalHours);
            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke="rgb(var(--color-muted))"
                strokeWidth={isHourTick ? 1.5 : 0.75}
                opacity={(isHourTick ? 0.55 : 0.3) * dim}
                style={TRANSITION}
              />
            );
          })}

          {/* hour number, dimmed once the hand has swept past it. '12h': plain 1–12 label plus its
              live-flipping AM/PM suffix. '24h': the same position's effective 00–23 military hour
              instead — same flip instant, just a different number and no suffix line at all. */}
          {positions.map((pos) => {
            const numberPos = polarToCartesian(RING_INNER - 15, pos.angle);
            return (
              <g key={pos.label} style={TRANSITION} opacity={pos.dim}>
                <text
                  x={numberPos.x}
                  y={numberPos.y + (timeFormat === '24h' ? 0 : -5)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="rgb(var(--color-foreground))"
                >
                  {timeFormat === '24h' ? String(effectiveHourAt(pos.label, decimalHours)).padStart(2, '0') : pos.label}
                </text>
                {timeFormat === '12h' && (
                  <text
                    x={numberPos.x}
                    y={numberPos.y + 9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fontWeight={600}
                    letterSpacing={0.5}
                    fill="rgb(var(--color-muted))"
                  >
                    {pos.isPM ? 'PM' : 'AM'}
                  </text>
                )}
              </g>
            );
          })}

          {/* hour hand — continuous motion, a slow CSS transition smooths the once-a-second angle jump */}
          <line
            x1={CENTER}
            y1={CENTER}
            x2={handTip.x}
            y2={handTip.y}
            stroke="rgb(var(--color-primary))"
            strokeWidth={4}
            strokeLinecap="round"
            style={{ transition: 'x2 900ms linear, y2 900ms linear' }}
          />
          <circle cx={CENTER} cy={CENTER} r={5} fill="rgb(var(--color-primary))" />
        </svg>

        {timeFormat === '12h' && (
          <div className="flex items-center gap-3">
            <PeriodBadge label="AM" icon={Sun} active={!isCurrentlyPM} />
            <PeriodBadge label="PM" icon={Moon} active={isCurrentlyPM} />
          </div>
        )}

        <p className="text-xs text-muted">
          {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h' })}
        </p>
      </div>

      <UpNextStack slots={slots} decimalHours={decimalHours} />
    </div>
  );
}

/** The next occurrence of every slot, soonest first, as a shallow physical-looking card stack — the
 * closest one sits fully on top, each one behind it peeks out a little less (smaller, dimmer, offset
 * up slightly less negative margin than a plain list would give). Wraps past midnight: a slot whose
 * start already happened today is timed against its occurrence 24h from now instead. */
function UpNextStack({ slots, decimalHours }: { slots: TimeSlot[]; decimalHours: number }) {
  if (slots.length === 0) return null;

  const upcoming = slots
    .map((slot) => {
      const startDec = toDecimalHours(slot.startTime);
      let endDec = toDecimalHours(slot.endTime);
      if (endDec <= startDec) endDec += 24;
      // A slot already in progress (now falls within [start, end), checking the +24 wrap too) is
      // "now," not "in 23h 59m until it starts again tomorrow" — the naive forward-distance-to-start
      // computation below would otherwise say exactly that for anything currently happening.
      const inProgress =
        (decimalHours >= startDec && decimalHours < endDec) || (decimalHours + 24 >= startDec && decimalHours + 24 < endDec);
      const hoursUntil = inProgress ? 0 : ((startDec - decimalHours) % 24 + 24) % 24;
      return { slot, hoursUntil, inProgress };
    })
    .sort((a, b) => a.hoursUntil - b.hoursUntil)
    .slice(0, 4);

  return (
    <div>
      <p className="mb-2.5 text-center text-xs font-medium text-muted">Up next</p>
      <div className="mx-auto flex max-w-xs flex-col">
        {upcoming.map(({ slot, hoursUntil, inProgress }, i) => (
          <div
            key={slot.id}
            className="rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-sm transition-all duration-300"
            style={{
              marginTop: i === 0 ? 0 : -16,
              zIndex: upcoming.length - i,
              transform: `scale(${1 - i * 0.04})`,
              opacity: 1 - i * 0.18,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorValue(slot.color) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{slot.label}</p>
                <p className="truncate text-xs text-muted">
                  {slot.startTime}–{slot.endTime}
                </p>
              </div>
              <span className={clsx('shrink-0 text-xs font-medium', inProgress ? 'text-primary' : 'text-muted')}>
                {inProgress || hoursUntil < 1 / 120 ? 'now' : `in ${formatMinutes(Math.round(hoursUntil * 60))}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Left is always AM, right is always PM — fixed positions so muscle memory builds fast, per the
 * design call. Active side gets full opacity, bold weight, accent color, and a small underline;
 * inactive sits dim/grey. Both are permanently mounted (never conditionally rendered) so the
 * opacity/color/underline changes cross-fade via CSS transition rather than popping in/out — the
 * only moment this actually fires is the 12→1 crossover at noon/midnight. */
function PeriodBadge({ label, icon: Icon, active }: { label: string; icon: typeof Sun; active: boolean }) {
  return (
    <span
      className={clsx(
        'relative flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-all duration-300',
        active ? 'bg-primary/10 font-bold text-primary opacity-100' : 'font-medium text-muted opacity-40'
      )}
    >
      <Icon size={12} />
      {label}
      <span
        className={clsx(
          'absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-primary transition-opacity duration-300',
          active ? 'opacity-100' : 'opacity-0'
        )}
      />
    </span>
  );
}
