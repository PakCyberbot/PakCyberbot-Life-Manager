import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, FileWarning, FileX, FolderOpen, Play, Plus, Trash2 } from 'lucide-react';
import { getApi, useBooksStore, useUiFocusStore, useVideosStore } from '@life-manager/core';
import { formatDate, type Book, type BookStatus, type Video, type VideoKind, type VideoStatus } from '@life-manager/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select } from '../components/ui/FormControls';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { renderPdfCoverFromBase64 } from '../lib/pdfCover';
import clsx from 'clsx';

type Tab = 'books' | 'videos';

const BOOK_STATUS_TONE: Record<BookStatus, 'default' | 'warning' | 'success'> = {
  'to-read': 'default',
  reading: 'warning',
  finished: 'success',
};

const VIDEO_STATUS_TONE: Record<VideoStatus, 'default' | 'warning' | 'success'> = {
  'to-watch': 'default',
  watching: 'warning',
  watched: 'success',
};

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('books');
  const { books, fetchBooks, loaded: booksLoaded } = useBooksStore();
  const { videos, fetchVideos, loaded: videosLoaded } = useVideosStore();
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [hostname, setHostname] = useState<string | null>(null);
  const [hostFilter, setHostFilter] = useState<string>('all');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const { libraryFocus, clearLibraryFocus } = useUiFocusStore();

  useEffect(() => {
    if (!booksLoaded) fetchBooks();
    if (!videosLoaded) fetchVideos();
    getApi().system.hostname().then(setHostname);
    useBooksStore.getState().subscribeToBookmarkUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A Task's linked book/video sets this (see GoalsScreen) to jump straight
  // to that item — switch to its tab, remember its id to scroll+highlight it,
  // then clear the signal so it only fires once per navigation.
  useEffect(() => {
    if (!libraryFocus) return;
    setTab(libraryFocus.type === 'book' ? 'books' : 'videos');
    setHighlightId(libraryFocus.id);
    clearLibraryFocus();
  }, [libraryFocus, clearLibraryFocus]);

  // Distinct machines that have added at least one book with a real file path.
  // A book with no path at all is visible regardless of which host is
  // selected (there's nowhere for it to "belong" — see BooksGrid's filter).
  const bookHosts = useMemo(
    () => [...new Set(books.map((b) => b.hostname).filter((h): h is string => Boolean(h)))].sort(),
    [books]
  );
  const filteredBooks = useMemo(
    () => (hostFilter === 'all' ? books : books.filter((b) => !b.hostname || b.hostname === hostFilter)),
    [books, hostFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
            <p className="mt-1 text-sm text-muted">Books to read, videos to watch.</p>
          </div>
          {tab === 'books' && bookHosts.length > 1 && (
            <div className="w-40 shrink-0">
            <Select
              value={hostFilter}
              onChange={(e) => setHostFilter(e.target.value)}
              className="h-8 text-xs"
              title="Filter books by which machine they were added from"
            >
              <option value="all">All hosts</option>
              {bookHosts.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
            </div>
          )}
        </div>
        <Button onClick={() => (tab === 'books' ? setBookDialogOpen(true) : setVideoDialogOpen(true))}>
          <Plus size={16} />
          {tab === 'books' ? 'New book' : 'New video'}
        </Button>
      </div>

      <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
        {(['books', 'videos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-surface text-accentLibrary shadow-sm' : 'text-muted hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'books' ? (
        <BooksGrid books={filteredBooks} hostname={hostname} highlightId={highlightId} onEmptyAdd={() => setBookDialogOpen(true)} />
      ) : (
        <VideosGrid videos={videos} highlightId={highlightId} onEmptyAdd={() => setVideoDialogOpen(true)} />
      )}

      <NewBookDialog open={bookDialogOpen} onClose={() => setBookDialogOpen(false)} />
      <NewVideoDialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

function BooksGrid({
  books,
  hostname,
  highlightId,
  onEmptyAdd,
}: {
  books: Book[];
  hostname: string | null;
  highlightId: string | null;
  onEmptyAdd: () => void;
}) {
  const { removeBook, setBookmark, openBook, openBookExternally } = useBooksStore();
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`library-book-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, books]);

  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={28} />}
        title="No books yet"
        description="Add a title, and optionally point it at a PDF — opens in-app with your bookmark tracked automatically."
        action={
          <Button size="sm" onClick={onEmptyAdd}>
            <Plus size={14} /> New book
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {openError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <FileWarning size={15} />
          {openError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {books.map((b) => {
          const onOtherMachine = b.hostname && hostname && b.hostname !== hostname;
          return (
            <Card
              key={b.id}
              id={`library-book-${b.id}`}
              className={clsx(
                'group flex flex-col overflow-hidden',
                highlightId === b.id && 'ring-2 ring-accentLibrary'
              )}
            >
              <button
                onClick={async () => {
                  setOpenError(null);
                  const result = await openBook(b);
                  if (!result.ok) setOpenError(result.error ?? 'Could not open this book.');
                }}
                className="relative aspect-[3/4] w-full overflow-hidden bg-background"
                title={b.filePath ? 'Open in-app — bookmark tracked automatically' : 'No file linked'}
              >
                {b.coverImage ? (
                  <img src={b.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BookCoverFallback title={b.title} />
                )}
                {!b.filePath ? (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/70 px-2 py-1 text-[10px] text-white">
                    <FileX size={11} /> No file linked
                  </div>
                ) : (
                  onOtherMachine && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/70 px-2 py-1 text-[10px] text-white">
                      <FileWarning size={11} /> on {b.hostname}
                    </div>
                  )
                )}
              </button>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{b.title}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={BOOK_STATUS_TONE[b.status]} className="w-fit">
                    {b.status}
                  </Badge>
                  {b.category && (
                    <Badge tone="goals" className="w-fit" title="Linked to this goal via a Task">
                      {b.category}
                    </Badge>
                  )}
                </div>
                {b.filePath && (
                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted">Page</span>
                    <input
                      type="number"
                      min={1}
                      value={b.bookmarkPage}
                      onChange={(e) => setBookmark(b.id, Number(e.target.value))}
                      className="h-6 w-14 rounded border border-border bg-background px-1.5 text-xs"
                    />
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {b.filePath && (
                    <button
                      onClick={async () => {
                        setOpenError(null);
                        const result = await openBookExternally(b);
                        if (!result.ok) setOpenError(result.error ?? 'Could not open this book.');
                      }}
                      title="Open with external reader (no auto-bookmark)"
                      className="text-muted hover:text-foreground"
                    >
                      <ExternalLink size={13} />
                    </button>
                  )}
                  <button onClick={() => removeBook(b.id)} title="Delete" className="text-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function BookCoverFallback({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-accentLibrary/25 via-accentLibrary/10 to-transparent p-4 text-center">
      <BookOpen size={22} className="text-accentLibrary" />
      <span className="line-clamp-3 text-xs font-medium text-foreground/80">{title}</span>
    </div>
  );
}

function NewBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addBook, updateBook } = useBooksStore();
  const [title, setTitle] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const browse = async () => {
    const picked = await getApi().dialog.pickPdf();
    if (picked) {
      setFilePath(picked);
      if (!title.trim()) {
        const base = picked.split(/[\\/]/).pop() ?? picked;
        setTitle(base.replace(/\.pdf$/i, ''));
      }
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    const book = await addBook({ title: title.trim(), filePath });
    setTitle('');
    setFilePath(null);
    onClose();

    if (filePath) {
      setRendering(true);
      const base64 = await getApi().system.readFileAsBase64(filePath);
      if (base64) {
        const cover = await renderPdfCoverFromBase64(base64);
        if (cover) await updateBook(book.id, { coverImage: cover });
      }
      setRendering(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New book">
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep Work" autoFocus />
        </Field>
        <Field label="PDF file (optional, custom path)">
          <div className="flex gap-2">
            <Input value={filePath ?? ''} readOnly placeholder="No file selected" className="flex-1" />
            <Button variant="outline" size="sm" onClick={browse} type="button">
              <FolderOpen size={14} /> Browse
            </Button>
          </div>
          {filePath && (
            <p className="mt-1 text-[11px] text-muted">
              Linked to this machine — the cover renders from page 1 once added.
            </p>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Add book
          </Button>
        </div>
        {rendering && <p className="text-center text-[11px] text-muted">Rendering cover…</p>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

function VideosGrid({
  videos,
  highlightId,
  onEmptyAdd,
}: {
  videos: Video[];
  highlightId: string | null;
  onEmptyAdd: () => void;
}) {
  const { removeVideo, updateVideo } = useVideosStore();

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`library-video-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, videos]);

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<Play size={28} />}
        title="No videos yet"
        description="Paste a YouTube video or playlist URL — the thumbnail is fetched automatically."
        action={
          <Button size="sm" onClick={onEmptyAdd}>
            <Plus size={14} /> New video
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {videos.map((v) => (
        <Card
          key={v.id}
          id={`library-video-${v.id}`}
          className={clsx('group flex flex-col overflow-hidden', highlightId === v.id && 'ring-2 ring-accentLibrary')}
        >
          <button
            onClick={() => getApi().system.openExternal(v.url)}
            title="Open in browser"
            className="relative block aspect-video w-full overflow-hidden bg-background"
          >
            {v.thumbnail ? (
              <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accentLibrary/25 to-transparent">
                <Play size={22} className="text-accentLibrary" />
              </div>
            )}
            <Badge tone="library" className="absolute left-2 top-2 capitalize">
              {v.kind}
            </Badge>
          </button>
          <div className="flex flex-1 flex-col gap-1.5 p-3">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</p>
            <div className="flex flex-wrap items-center gap-1">
              <select
                value={v.status}
                onChange={(e) => updateVideo(v.id, { status: e.target.value as VideoStatus })}
                className="w-fit rounded-md border border-border bg-background px-1.5 py-0.5 text-xs"
              >
                <option value="to-watch">To watch</option>
                <option value="watching">Watching</option>
                <option value="watched">Watched</option>
              </select>
              {v.category && (
                <Badge tone="goals" className="w-fit" title="Linked to this goal via a Task">
                  {v.category}
                </Badge>
              )}
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted">{formatDate(v.createdAt)}</span>
              <button onClick={() => removeVideo(v.id)} className="text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function NewVideoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addVideo } = useVideosStore();
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<VideoKind>('video');
  const [fetching, setFetching] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setFetching(true);
    await addVideo({ url: url.trim(), kind });
    setFetching(false);
    setUrl('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New video">
      <div className="space-y-3">
        <Field label="YouTube URL (video or playlist)">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." autoFocus />
        </Field>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as VideoKind)}>
            <option value="video">Single video</option>
            <option value="playlist">Playlist</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!url.trim() || fetching}>
            {fetching ? 'Fetching thumbnail…' : 'Add video'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
