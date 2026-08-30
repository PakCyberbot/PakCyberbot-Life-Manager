import type { DaySchedule, TimeSlot } from '@life-manager/shared';

// A creative alternative to the plain list: two analog 12-hour clock faces
// (AM: 12am–12pm, PM: 12pm–12am) with a colored ring showing exactly which
// hours are covered by which time slot — like a daily activity-ring chart,
// but drawn as a real clock face rather than a bar. The asleep window (the
// gap between sleepTime and the next wakeTime) is drawn in low opacity so it
// visually recedes, while every real time slot keeps its full color, with a
// legend underneath spelling out label + time range (curved on-ring text
// would be unreadable at this size, so the ring communicates *coverage*
// while the legend carries the *labels*).

const CLOCK_SIZE = 200;
const RING_RADIUS = 78;
const RING_WIDTH = 16;
const CENTER = CLOCK_SIZE / 2;

function toDecimalHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

/** SVG path for a clockwise ring arc from startAngle to endAngle (degrees, 0 = 12 o'clock). */
function describeArc(radius: number, startAngle: number, endAngle: number): string {
  if (endAngle <= startAngle) return '';
  // A full 360° arc needs splitting — start === end confuses the arc flag math otherwise.
  if (endAngle - startAngle >= 359.99) {
    const mid = startAngle + 180;
    return `${describeArc(radius, startAngle, mid)} ${describeArc(radius, mid, endAngle)}`;
  }
  const start = polarToCartesian(radius, startAngle);
  const end = polarToCartesian(radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

interface ClockSegment {
  clock: 'am' | 'pm';
  startAngle: number;
  endAngle: number;
}

/** Splits a [startDec, endDecRaw) 24h-decimal range (endDecRaw may exceed 24 for an overnight wrap)
 * into per-clock-face angle segments — a range can span the AM face, the PM face, or both. */
function splitIntoClockSegments(startDec: number, endDecRaw: number): ClockSegment[] {
  const bounds: [number, number, 'am' | 'pm'][] = [
    [0, 12, 'am'],
    [12, 24, 'pm'],
    [24, 36, 'am'], // wrapped past midnight — maps back onto the same AM face
  ];
  const segments: ClockSegment[] = [];
  for (const [lo, hi, clock] of bounds) {
    const segStart = Math.max(startDec, lo);
    const segEnd = Math.min(endDecRaw, hi);
    if (segEnd > segStart) {
      segments.push({ clock, startAngle: (segStart - lo) * 30, endAngle: (segEnd - lo) * 30 });
    }
  }
  return segments;
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

interface RingArc {
  clock: 'am' | 'pm';
  startAngle: number;
  endAngle: number;
  color: string;
  opacity: number;
}

export function TimeTableClock({ schedule, slots }: { schedule: DaySchedule | undefined; slots: TimeSlot[] }) {
  const arcs: RingArc[] = [];

  if (schedule) {
    const sleepDec = toDecimalHours(schedule.sleepTime);
    let wakeDec = toDecimalHours(schedule.wakeTime);
    if (wakeDec <= sleepDec) wakeDec += 24; // overnight wrap, same convention as minutesBetween
    for (const seg of splitIntoClockSegments(sleepDec, wakeDec)) {
      arcs.push({ ...seg, color: 'rgb(var(--color-muted))', opacity: 0.25 });
    }
  }

  for (const slot of slots) {
    const startDec = toDecimalHours(slot.startTime);
    let endDec = toDecimalHours(slot.endTime);
    if (endDec <= startDec) endDec += 24;
    for (const seg of splitIntoClockSegments(startDec, endDec)) {
      arcs.push({ ...seg, color: colorValue(slot.color), opacity: 1 });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-center gap-8">
        <ClockFace title="AM — 12am to 12pm" arcs={arcs.filter((a) => a.clock === 'am')} />
        <ClockFace title="PM — 12pm to 12am" arcs={arcs.filter((a) => a.clock === 'pm')} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-muted/40" />
          Asleep
        </span>
        {slots.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorValue(s.color) }} />
            <span className="font-medium">{s.label}</span>
            <span className="text-muted">
              {s.startTime}–{s.endTime}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ClockFace({ title, arcs }: { title: string; arcs: RingArc[] }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={CLOCK_SIZE} height={CLOCK_SIZE} viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}>
        {/* base ring track */}
        <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" stroke="rgb(var(--color-border))" strokeWidth={RING_WIDTH} />
        {/* hour ticks + numbers, 12 around the face */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          const tickInner = polarToCartesian(RING_RADIUS - RING_WIDTH / 2 - 3, angle);
          const tickOuter = polarToCartesian(RING_RADIUS - RING_WIDTH / 2 - 8, angle);
          const numPos = polarToCartesian(RING_RADIUS + RING_WIDTH / 2 + 12, angle);
          const hourLabel = i === 0 ? 12 : i;
          return (
            <g key={i}>
              <line
                x1={tickInner.x}
                y1={tickInner.y}
                x2={tickOuter.x}
                y2={tickOuter.y}
                stroke="rgb(var(--color-muted))"
                strokeWidth={1}
                opacity={0.5}
              />
              <text x={numPos.x} y={numPos.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="rgb(var(--color-muted))">
                {hourLabel}
              </text>
            </g>
          );
        })}
        {/* coverage arcs — sleep drawn first (low opacity) so real slots layer cleanly on top */}
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={describeArc(RING_RADIUS, arc.startAngle, arc.endAngle)}
            fill="none"
            stroke={arc.color}
            strokeOpacity={arc.opacity}
            strokeWidth={RING_WIDTH}
            strokeLinecap="butt"
          />
        ))}
        {/* center hub */}
        <circle cx={CENTER} cy={CENTER} r={3} fill="rgb(var(--color-muted))" />
      </svg>
      <p className="text-xs font-medium text-muted">{title}</p>
    </div>
  );
}
