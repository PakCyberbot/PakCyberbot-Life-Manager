import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
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

const SIZE = 240;
const CENTER = SIZE / 2;
const FACE_RADIUS = 96;
const HAND_LENGTH = 64;

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

interface DialPosition {
  label: number; // 1–12, the number printed on the dial
  angle: number; // degrees, 0 = 12 o'clock, clockwise
  isPM: boolean;
}

/** For dial position `label`, its AM occurrence is hour `hourAM` (24h) and its PM occurrence is
 * `hourAM + 12` — always 12 apart within the same 0–24 day, so no modulo wraparound is needed. The
 * label reads PM for the open-closed window (hourAM, hourAM+12] and AM otherwise: at the AM instant
 * itself it still reads AM (matches what just happened), flips to PM the moment time moves past it,
 * and symmetrically flips back to AM the moment time moves past the PM instant — verified against the
 * spec's own worked example (7:00:00 AM still reads AM; just after, reads PM; just after 7:00:00 PM,
 * reads AM again) before wiring this into the render below. */
function computePositions(decimalHours: number): DialPosition[] {
  return Array.from({ length: 12 }, (_, i) => {
    const label = i === 0 ? 12 : i;
    const hourAM = label === 12 ? 0 : label;
    const hourPM = hourAM + 12;
    const isPM = decimalHours > hourAM && decimalHours <= hourPM;
    return { label, angle: i * 30, isPM };
  });
}

export function LiveRotatingClock() {
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
    <div className="flex flex-col items-center gap-5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="none" stroke="rgb(var(--color-border))" strokeWidth={2} />

        {/* minute ticks, every 6°, hour ticks a little longer/bolder */}
        {Array.from({ length: 60 }).map((_, i) => {
          const isHourTick = i % 5 === 0;
          const outer = polarToCartesian(FACE_RADIUS, i * 6);
          const inner = polarToCartesian(FACE_RADIUS - (isHourTick ? 8 : 4), i * 6);
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="rgb(var(--color-muted))"
              strokeWidth={isHourTick ? 1.5 : 0.75}
              opacity={isHourTick ? 0.55 : 0.3}
            />
          );
        })}

        {/* hour number + its live-flipping AM/PM suffix */}
        {positions.map((pos) => {
          const numberPos = polarToCartesian(FACE_RADIUS - 22, pos.angle);
          return (
            <g key={pos.label}>
              <text x={numberPos.x} y={numberPos.y - 5} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={600} fill="rgb(var(--color-foreground))">
                {pos.label}
              </text>
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

      <div className="flex items-center gap-3">
        <PeriodBadge label="AM" icon={Sun} active={!isCurrentlyPM} />
        <PeriodBadge label="PM" icon={Moon} active={isCurrentlyPM} />
      </div>

      <p className="text-xs text-muted">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
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
