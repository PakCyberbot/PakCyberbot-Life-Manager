import { useEffect, useRef } from 'react';
import clsx from 'clsx';

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const DIAL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
/** Vertical padding so row 1 and the last row can still scroll to dead-center — half the dial's
 * height minus half a row, same logic a horizontal date-picker wheel would use, just rotated. */
const PAD = (DIAL_HEIGHT - ROW_HEIGHT) / 2;

/** A vertically-scrollable, snap-to-center column of page numbers — the mobile PDF reader's
 * replacement for free-text page entry. Scrolling it (via touch, same as any native picker wheel)
 * or tapping a number jumps `page` to that number; an external `page` change (the reader's own
 * IntersectionObserver tracking what's actually on screen) recenters the dial to match, without
 * feeding back into another onChange call for the same value. */
export function PageNumberDial({
  totalPages,
  page,
  onChange,
}: {
  totalPages: number;
  page: number;
  onChange: (page: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set right before a programmatic scroll (from an external `page` change) and read by the
  // scroll-end handler below — skips firing onChange for a jump the dial didn't itself originate,
  // while still letting the user's own scroll be able to correct it on their very next touch.
  const suppressNextRef = useRef(false);

  // Recenter on `page` changing from outside (the reader scrolling to a new current page) —
  // guarded so this doesn't fire back through the scroll-end handler as a duplicate onChange.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = (page - 1) * ROW_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 2) return; // already there — e.g. this effect's own prior scroll
    suppressNextRef.current = true;
    el.scrollTo({ top: target, behavior: 'smooth' });
  }, [page]);

  const handleScroll = () => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    // Scroll-end debounce, not a live per-frame read — snap position only really settles once
    // scrolling stops, and reading mid-scroll would report a page that's still sliding past.
    scrollTimerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const nearest = Math.min(totalPages, Math.max(1, Math.round(el.scrollTop / ROW_HEIGHT) + 1));
      if (suppressNextRef.current) {
        suppressNextRef.current = false;
        return;
      }
      if (nearest !== page) onChange(nearest);
    }, 120);
  };

  const jumpTo = (target: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: (target - 1) * ROW_HEIGHT, behavior: 'smooth' });
    onChange(target);
  };

  return (
    <div className="relative" style={{ height: DIAL_HEIGHT }}>
      {/* Center highlight band, purely visual — sits behind the scrolling numbers. */}
      <div
        className="pointer-events-none absolute inset-x-2 z-0 rounded-lg bg-primary/10"
        style={{ top: PAD, height: ROW_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto"
        style={{ paddingTop: PAD, paddingBottom: PAD }}
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => jumpTo(n)}
            className={clsx(
              'flex w-full snap-center items-center justify-center text-sm transition-colors',
              n === page ? 'font-semibold text-primary' : 'text-muted'
            )}
            style={{ height: ROW_HEIGHT }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
