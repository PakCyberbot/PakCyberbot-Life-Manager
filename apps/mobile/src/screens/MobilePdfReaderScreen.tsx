import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Filesystem } from '@capacitor/filesystem';
import { List, X } from 'lucide-react';
import { base64ToBytes, PageNumberDial } from '@life-manager/ui';
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
// lazily-rendered, scrollable multi-page reader.
//
// Pages render virtualized around whatever page is currently on screen (RENDER_WINDOW either
// side) rather than all at once — a 300-page PDF fully rendered to canvas at once would be a
// real memory problem on a phone. The currently-visible page is tracked via one shared
// IntersectionObserver watching every page container (highest intersectionRatio wins), which
// both drives the render window and debounce-saves the bookmark, same pattern already used
// elsewhere in this app for "recompute from what's actually observed, don't infer."

const RENDER_WINDOW = 2;
const BOOKMARK_SAVE_DEBOUNCE_MS = 800;

export function MobilePdfReaderScreen({ book, onClose }: { book: Book; onClose: () => void }) {
  const { setBookmark } = useBooksStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasScrolledToBookmark = useRef(false);
  const bookmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(Math.max(1, book.bookmarkPage || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialOpen, setDialOpen] = useState(false);

  // Load the document once per book.
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

        const page1 = await doc.getPage(1);
        const containerWidth = containerRef.current?.clientWidth || 360;
        const baseViewport = page1.getViewport({ scale: 1 });
        const viewport = page1.getViewport({ scale: containerWidth / baseViewport.width });
        if (cancelled) return;
        setPageSize({ width: viewport.width, height: viewport.height });
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

  // Resume at the bookmark once page geometry is known — needs pageSize so every container
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

  // One IntersectionObserver for every page container — whichever has the greatest intersection
  // ratio right now is "the" current page.
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

  // Debounced bookmark autosave — same idea as every other debounced write in this app (Auto
  // Sync's push, the desktop in-app viewer's own bookmark tracking).
  useEffect(() => {
    if (!currentPage) return;
    if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current);
    bookmarkTimerRef.current = setTimeout(() => {
      if (currentPage !== book.bookmarkPage) setBookmark(book.id, currentPage);
    }, BOOKMARK_SAVE_DEBOUNCE_MS);
    return () => {
      if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground">
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

      {loading && <div className="flex flex-1 items-center justify-center text-sm text-muted">Opening…</div>}
      {error && <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-red-500">{error}</div>}

      {!loading && !error && pdf && pageSize && (
        <div className="relative flex-1 overflow-hidden">
          <div ref={containerRef} className="h-full overflow-y-auto">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                data-page={n}
                ref={(el) => {
                  if (el) pageRefs.current.set(n, el);
                  else pageRefs.current.delete(n);
                }}
                style={{ height: pageSize.height }}
                className="mx-auto border-b border-border/40"
              >
                {renderedPages.has(n) && <PdfPageCanvas pdf={pdf} pageNumber={n} width={pageSize.width} />}
              </div>
            ))}
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
        </div>
      )}
    </div>
  );
}

/** One page's own render effect, isolated per-component so mounting/unmounting a page (as the
 * render window slides with `currentPage`) cleanly cancels any render still in flight for a page
 * that's just scrolled back out of the window — pdf.js's own RenderTask.cancel(), not just
 * abandoning the promise. */
function PdfPageCanvas({ pdf, pageNumber, width }: { pdf: PDFDocumentProxy; pageNumber: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / baseViewport.width });
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
  }, [pdf, pageNumber, width]);

  return <canvas ref={canvasRef} className="mx-auto block h-full" />;
}
