import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderQuoteMarkdown } from '../../lib/quoteMarkdown';

interface QuoteTextProps {
  text: string;
  className?: string;
  /** How many lines' worth of height to clip to before auto-scrolling kicks in. Default 2, per
   * the Dashboard quote card's own ask ("if more than 2 lines are given... should be
   * automatically scrolling"). */
  maxLines?: number;
}

/** Renders a quote's text (markdown emphasis + real line breaks, via renderQuoteMarkdown) inside a
 * box clipped to `maxLines` lines. If the real content is taller than that, it auto-scrolls in a
 * slow, looping cycle — pause at the top, scroll down to reveal the rest, pause at the bottom,
 * snap back to the top, repeat — rather than ellipsis-truncating a quote the user specifically
 * wrote to be read in full. Measures the actual rendered height at runtime (via the real
 * `line-height` of the rendered text, not a guessed pixel value), so it's correct regardless of
 * font-size/zoom/platform. Used by both apps' Dashboard "current quote" card; Settings' plain
 * quote-management list uses `renderQuoteMarkdown` directly instead, since a static list of many
 * quotes has no single "current" one to loop. */
export function QuoteText({ text, className, maxLines = 2 }: QuoteTextProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState(0);

  // Measure after every text change (and on mount) — the outer box's clip height is set here
  // imperatively (computed from the real line-height) rather than via a Tailwind class, since
  // "N lines" isn't a fixed pixel value Tailwind can express for an arbitrary font/zoom level.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    inner.style.transform = 'translateY(0px)';
    const lineHeight = parseFloat(getComputedStyle(inner).lineHeight) || 20;
    const clipHeight = lineHeight * maxLines;
    outer.style.maxHeight = `${clipHeight}px`;
    setOverflow(Math.max(0, inner.scrollHeight - clipHeight));
  }, [text, maxLines]);

  // The actual loop: pause at top, scroll down over a duration proportional to how much there is
  // to show, pause at the bottom, then snap back to the top and repeat. Driven by elapsed wall-
  // clock time modulo one full cycle (via requestAnimationFrame) rather than a chain of timeouts,
  // so it can't drift or double-fire across re-renders.
  useEffect(() => {
    if (overflow <= 0) return;
    const inner = innerRef.current;
    if (!inner) return;

    const PAUSE_MS = 1600;
    const PX_PER_MS = 0.025; // ~25px/s — slow enough to actually read while it moves
    const scrollMs = overflow / PX_PER_MS;
    const cycleMs = PAUSE_MS * 2 + scrollMs;

    let raf: number;
    let start: number | null = null;

    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = (t - start) % cycleMs;
      let y: number;
      if (elapsed < PAUSE_MS) {
        y = 0;
      } else if (elapsed < PAUSE_MS + scrollMs) {
        y = -((elapsed - PAUSE_MS) * PX_PER_MS);
      } else {
        y = -overflow;
      }
      inner.style.transform = `translateY(${y}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overflow]);

  return (
    <div ref={outerRef} className="overflow-hidden">
      <div ref={innerRef} className={className}>
        {renderQuoteMarkdown(text)}
      </div>
    </div>
  );
}
