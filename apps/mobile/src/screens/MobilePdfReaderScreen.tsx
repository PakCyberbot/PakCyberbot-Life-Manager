import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Filesystem } from '@capacitor/filesystem';
import { Bookmark, BookmarkCheck, List, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { base64ToBytes, Button, PageNumberDial } from '@life-manager/ui';
import { useBooksStore } from '@life-manager/core';
import type { Book } from '@life-manager/shared';

// Importing base64ToBytes from @life-manager/ui pulls in pdfCover.ts as a dependency, whose own
// top-level code already points pdfjsLib.GlobalWorkerOptions.workerSrc at the bundled worker —
// same worker asset this app's build already produces (confirmed in the mobile build output),
// so no separate ?url import is needed here.

// A genuinely new subsystem — desktop's book reading is Chromium's own built-in PDF viewer
// (main.ts's openBookInAppWindow), which has no mobile equivalent; mobile previously only ever
// handed a book off to whatever external app the user picked (openBookWithSystemViewer in
// mobileApi.ts), with no way to track a bookmark from outside this app's own control. This
// extends pdfCover.ts's single-page rendering (already used for Library thumbnails) to a real,
// lazily-rendered, scrollable, zoomable, rotatable multi-page reader.
//
// Pages render virtualized around whatever page is currently on screen (RENDER_WINDOW either
// side) rather than all at once — a 300-page PDF fully rendered to canvas at once would be a
// real memory problem on a phone. The currently-visible page is tracked via one shared
// IntersectionObserver watching every page container (highest intersectionRatio wins), which
// drives the render window and the page-number readout, same "recompute from what's actually
// observed, don't infer" pattern already used elsewhere in this app.
//
// Bookmarking is deliberately NOT tied to that observer anymore — an earlier version debounce-
// saved the bookmark to whatever page the observer last reported, which meant an accidental
// scroll (a stray touch, a fast fling past the intended page) silently overwrote a real bookmark
// with nothing to undo it. Bookmarking is now always an explicit choice: a manual toolbar button
// (bookmarks the page on screen right now, no confirmation needed since tapping it already is
// one), or a "Bookmark page N?" prompt offered on close whenever the page you're leaving on
// differs from the one already saved — either way, nothing is written without a deliberate yes.
//
// Zoom responds to both the toolbar +/- buttons and a real two-finger pinch (native touch
// listeners, not React's onTouch* props — Chrome/WebView attach React's own synthetic touch
// handlers as passive by default, which silently makes preventDefault() a no-op exactly when a
// pinch needs it to stop the page's own scroll from fighting the gesture). A pinch drives a purely
// visual CSS transform (pinchScale) live, frame by frame, cheap; only on lifting the fingers does
// it commit to the real `zoom` state, which is what actually triggers a fresh, sharp pdf.js
// render at the new resolution — re-rendering every page on every touchmove event would be both
// needless work and visibly janky.
//
// Device rotation (turning the phone to landscape) isn't handled by the manual Rotate button at
// all — that one rotates the *page content* 90° in place (for a sideways-scanned document), a
// different axis entirely from the *device* changing shape. MainActivity carries no
// android:screenOrientation lock, so Android already lets the WebView reflow to landscape on its
// own; what was missing is this component noticing that reflow at all — a ResizeObserver on the
// scroll container re-runs the page-geometry calculation whenever its actual width changes for
// *any* reason (rotation, split-screen, anything), not just when this component's own zoom/
// rotation state changes.

const RENDER_WINDOW = 2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
type Rotation = 0 | 90 | 180 | 270;

export function MobilePdfReaderScreen({ book, onClose }: { book: Book; onClose: () => void }) {
  const { setBookmark } = useBooksStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasScrolledToBookmark = useRef(false);
  // Set right before a zoom/rotation change so the pageSize-changed effect below knows to
  // re-center on the current page — not set on the very first geometry computation, which the
  // resume-at-bookmark effect already handles its own way.
  const shouldRecenterRef = useRef(false);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(Math.max(1, book.bookmarkPage || 1));
  const [savedBookmark, setSavedBookmark] = useState(Math.max(1, book.bookmarkPage || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  // Live, purely-visual multiplier applied on top of the committed `zoom` while two fingers are
  // down — see the file-level comment on why this stays a CSS transform during the gesture rather
  // than driving real re-renders on every touchmove.
  const [pinchScale, setPinchScale] = useState(1);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Load the document once per book — geometry (page size) is computed separately below, since it
  // also needs to react to zoom/rotation changes, not just the initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!book.filePath) {
        setError('No file linked to this book.');
        setLoading(false);
        return;
      }
      try {
        // No `directory` — book.filePath is already a real absolute path (same convention
        // NewBookDialog/mobileDriveSync's downloadBookFile both write), so Filesystem reads it
        // directly rather than relative to one of Capacitor's named directories.
        const { data } = await Filesystem.readFile({ path: book.filePath });
        const base64 = typeof data === 'string' ? data : '';
        const doc = await pdfjsLib.getDocument({ data: base64ToBytes(base64) }).promise;
        if (cancelled) return;
        setNumPages(doc.numPages);
        setPdf(doc);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.filePath]);

  // Page geometry — recomputed whenever the document first loads, or zoom/rotation change.
  // pdf.js's own getViewport({ scale, rotation }) does the actual rotation math (swapping width/
  // height for 90°/270°); this only has to feed it the right target scale for the current zoom.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const page1 = await pdf.getPage(1);
      if (cancelled) return;
      const containerWidth = containerRef.current?.clientWidth || 360;
      const baseViewport = page1.getViewport({ scale: 1, rotation });
      const viewport = page1.getViewport({ scale: (containerWidth * zoom) / baseViewport.width, rotation });
      if (cancelled) return;
      setPageSize({ width: viewport.width, height: viewport.height });
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, zoom, rotation]);

  // Re-run the same geometry calculation whenever the container's own rendered width changes for
  // a reason *other* than our own zoom/rotation state — the actual mechanism behind "auto-adjust
  // on device rotation": turning the phone to landscape changes containerRef's clientWidth without
  // touching zoom or rotation at all, so the effect above alone would never notice.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pdf) return;
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      shouldRecenterRef.current = true;
      (async () => {
        const page1 = await pdf.getPage(1);
        const baseViewport = page1.getViewport({ scale: 1, rotation });
        const viewport = page1.getViewport({ scale: (width * zoomRef.current) / baseViewport.width, rotation });
        setPageSize({ width: viewport.width, height: viewport.height });
      })();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, rotation]);

  // Real two-finger pinch. Native listeners, not React's onTouch* props — synthetic touch
  // handlers are attached passively by default, which would make preventDefault() below silently
  // do nothing, letting the container's own scroll fight the gesture.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let pinching = false;
    let startDistance = 0;
    let startZoom = 1;

    const distance = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinching = true;
      startDistance = distance(e.touches);
      startZoom = zoomRef.current;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinching || e.touches.length !== 2 || startDistance === 0) return;
      e.preventDefault();
      setPinchScale(distance(e.touches) / startDistance);
    };
    const endPinch = () => {
      if (!pinching) return;
      pinching = false;
      setPinchScale((live) => {
        if (live !== 1) {
          shouldRecenterRef.current = true;
          setZoom(Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startZoom * live)) * 100) / 100);
        }
        return 1;
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', endPinch, { passive: true });
    el.addEventListener('touchcancel', endPinch, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endPinch);
      el.removeEventListener('touchcancel', endPinch);
    };
  }, []);

  // Resume at the bookmark once page geometry is first known — needs pageSize so every container
  // already has its real height and scrollIntoView lands in the right place the first time.
  useEffect(() => {
    if (hasScrolledToBookmark.current || !pageSize || !numPages) return;
    hasScrolledToBookmark.current = true;
    const target = Math.min(numPages, Math.max(1, book.bookmarkPage || 1));
    setCurrentPage(target);
    if (target > 1) {
      requestAnimationFrame(() => pageRefs.current.get(target)?.scrollIntoView({ block: 'start' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, numPages]);

  // Re-center on the current page after a zoom/rotation-triggered geometry change (every *later*
  // pageSize change past the initial one above, which resizes every page and would otherwise
  // leave the scroll position pointing at a visually different spot).
  useEffect(() => {
    if (!pageSize || !shouldRecenterRef.current) return;
    shouldRecenterRef.current = false;
    requestAnimationFrame(() => pageRefs.current.get(currentPage)?.scrollIntoView({ block: 'start' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // One IntersectionObserver for every page container — whichever has the greatest intersection
  // ratio right now is "the" current page. Drives the render window and the page-number readout
  // only — bookmarking is a separate, always-explicit action (see the file-level comment).
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !pageSize || !numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (!page || !entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.ratio) best = { page, ratio: entry.intersectionRatio };
        }
        if (best) setCurrentPage(best.page);
      },
      { root, threshold: [0.1, 0.25, 0.5, 0.75, 1] }
    );
    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [pageSize, numPages]);

  const renderedPages = useMemo(() => {
    const set = new Set<number>();
    const start = Math.max(1, currentPage - RENDER_WINDOW);
    const end = Math.min(numPages, currentPage + RENDER_WINDOW);
    for (let p = start; p <= end; p++) set.add(p);
    return set;
  }, [currentPage, numPages]);

  const jumpToPage = (page: number) => {
    setCurrentPage(page);
    pageRefs.current.get(page)?.scrollIntoView({ block: 'start' });
  };

  const changeZoom = (next: number) => {
    shouldRecenterRef.current = true;
    setZoom(Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)) * 100) / 100);
  };

  const rotate = () => {
    shouldRecenterRef.current = true;
    setRotation((r) => (((r + 90) % 360) as Rotation));
  };

  // Explicit, no confirmation needed — tapping this button already is the deliberate action.
  const bookmarkNow = async () => {
    await setBookmark(book.id, currentPage);
    setSavedBookmark(currentPage);
  };

  const handleClose = () => {
    if (currentPage !== savedBookmark) {
      setCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const confirmBookmarkAndClose = async () => {
    await setBookmark(book.id, currentPage);
    setSavedBookmark(currentPage);
    setCloseConfirmOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={handleClose} className="shrink-0 text-muted hover:text-foreground">
          <X size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">{book.title}</p>
        <button
          onClick={() => setDialOpen((v) => !v)}
          disabled={!numPages}
          className="shrink-0 text-muted hover:text-foreground disabled:opacity-40"
          title="Jump to page"
        >
          <List size={18} />
        </button>
      </div>

      {!loading && !error && (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 text-muted">
          <button
            onClick={bookmarkNow}
            title={currentPage === savedBookmark ? `Bookmarked here (page ${savedBookmark})` : `Bookmark page ${currentPage}`}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-background hover:text-foreground"
          >
            {currentPage === savedBookmark ? (
              <BookmarkCheck size={15} className="text-accentLibrary" />
            ) : (
              <Bookmark size={15} />
            )}
            <span>Bookmark p.{savedBookmark}</span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => changeZoom(zoom - ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              title="Zoom out"
              className="rounded-lg p-1.5 hover:bg-background hover:text-foreground disabled:opacity-30"
            >
              <ZoomOut size={16} />
            </button>
            <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => changeZoom(zoom + ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              title="Zoom in"
              className="rounded-lg p-1.5 hover:bg-background hover:text-foreground disabled:opacity-30"
            >
              <ZoomIn size={16} />
            </button>
            <button onClick={rotate} title="Rotate" className="rounded-lg p-1.5 hover:bg-background hover:text-foreground">
              <RotateCw size={16} />
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex flex-1 items-center justify-center text-sm text-muted">Opening…</div>}
      {error && <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-red-500">{error}</div>}

      {!loading && !error && pdf && pageSize && (
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={containerRef}
            onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
            className="h-full overflow-auto"
          >
            <div style={{ transform: pinchScale !== 1 ? `scale(${pinchScale})` : undefined, transformOrigin: 'center top' }}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  data-page={n}
                  ref={(el) => {
                    if (el) pageRefs.current.set(n, el);
                    else pageRefs.current.delete(n);
                  }}
                  style={{ height: pageSize.height, width: pageSize.width }}
                  className="mx-auto border-b border-border/40"
                >
                  {renderedPages.has(n) && (
                    // key forces a fresh <canvas> element whenever rotation/width change, rather
                    // than reusing one whose in-flight render pdf.js is still tearing down — see
                    // the file-level comment for why reusing the node here left the page blank.
                    <PdfPageCanvas
                      key={`${n}-${rotation}-${Math.round(pageSize.width)}`}
                      pdf={pdf}
                      pageNumber={n}
                      width={pageSize.width}
                      rotation={rotation}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {currentPage} / {numPages}
            </span>
          </div>

          {dialOpen && (
            <div className="absolute inset-y-0 right-0 flex items-center rounded-l-2xl bg-surface/95 px-2 shadow-xl backdrop-blur">
              <PageNumberDial totalPages={numPages} page={currentPage} onChange={jumpToPage} />
            </div>
          )}

          {closeConfirmOpen && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6">
              <div className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-xl">
                <p className="text-sm font-medium">Bookmark page {currentPage}?</p>
                <p className="mt-1 text-xs text-muted">
                  Your saved bookmark is currently page {savedBookmark}. Scrolling around while reading doesn't
                  change it on its own — only saved here if you say yes.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    No, just close
                  </Button>
                  <Button size="sm" onClick={confirmBookmarkAndClose}>
                    Yes, bookmark
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One page's own render effect, isolated per-component so mounting/unmounting a page (as the
 * render window slides with `currentPage`) cleanly cancels any render still in flight for a page
 * that's just scrolled back out of the window — pdf.js's own RenderTask.cancel(), not just
 * abandoning the promise. */
function PdfPageCanvas({
  pdf,
  pageNumber,
  width,
  rotation,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  rotation: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1, rotation });
      const viewport = page.getViewport({ scale: width / baseViewport.width, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        // Cancelled mid-render (scrolled back out of the window before it finished) — expected,
        // not a real error.
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, rotation]);

  return <canvas ref={canvasRef} className="mx-auto block h-full" />;
}
