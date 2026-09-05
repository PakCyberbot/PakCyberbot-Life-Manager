import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, FileWarning, Globe, Pencil, Play, Plus, Trash2, Upload } from 'lucide-react';
import { getApi, useBooksStore, useUiFocusStore, useVideosStore, useWebLinksStore } from '@life-manager/core';
import type { Book, VideoKind, WebLinkStatus, VideoStatus, Video, WebLink } from '@life-manager/shared';
import { Card, Badge, Button, Dialog, Field, Input, Switch, Textarea, EmptyState } from '@life-manager/ui';
import { Filesystem, Directory } from '@capacitor/filesystem';
import clsx from 'clsx';
import { readFileAsBase64 } from '../api/mobileApi';
import { MobilePdfReaderScreen } from './MobilePdfReaderScreen';

type Tab = 'books' | 'videos' | 'webLinks';
const TAB_LABEL: Record<Tab, string> = { books: 'Books', videos: 'Videos', webLinks: 'Web links' };
const ONLY_THIS_HOST_SETTING_KEY = 'libraryOnlyThisHostBooks';

// The one editable section on mobile — same three Library tabs as desktop,
// rebuilt single-column for a phone (not a port of desktop's LibraryScreen,
// which assumes a wide multi-column grid and native file-picker dialogs).
export function MobileLibraryScreen() {
  const [tab, setTab] = useState<Tab>('books');
  const { books, fetchBooks, loaded: booksLoaded, removeBook, updateBook } = useBooksStore();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { videos, fetchVideos, loaded: videosLoaded } = useVideosStore();
  const { webLinks, fetchWebLinks, loaded: webLinksLoaded } = useWebLinksStore();
  const [hostname, setHostname] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [onlyThisHost, setOnlyThisHost] = useState(false);
  // Off means pure browse/open; on reveals Delete (Books/Videos/Web links) and Edit (Videos/Web
  // links) everywhere — same top-right toggle pattern as Goals' Quick Tasks and Savings, so a
  // stray tap on a small phone screen can't misfire into deleting an entry.
  const [editMode, setEditMode] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editingWebLink, setEditingWebLink] = useState<WebLink | null>(null);
  // A book with a local filePath opens in the new in-app reader (full-screen overlay, rendered
  // below outside the normal tab flow) instead of handing off to the system viewer — the only
  // way bookmark tracking can work on mobile at all, since there's no way to observe another
  // app's reading position (same reasoning desktop's own in-app viewer was built for).
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  // A book's filePath can point at a file that no longer actually exists (app storage cleared, a
  // reinstall that only brought the database back via Drive sync and not the PDF bytes
  // themselves, etc.) — the row still looks "openable" by filePath/hostname alone, but opening it
  // would just fail. Checked once per books-list change via Filesystem.stat (rejects if missing);
  // a book that's both missing locally and has a driveFileId falls back to the same "Download"
  // affordance a never-downloaded book gets, rather than silently failing to open.
  const [missingFileIds, setMissingFileIds] = useState<Set<string>>(new Set());
  const { libraryFocus, clearLibraryFocus } = useUiFocusStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const checks = await Promise.all(
        books
          .filter((b) => !!b.filePath)
          .map(async (b) => {
            try {
              await Filesystem.stat({ path: b.filePath! });
              return null;
            } catch {
              return b.id;
            }
          })
      );
      if (cancelled) return;
      setMissingFileIds(new Set(checks.filter((id): id is string => id !== null)));
    })();
    return () => {
      cancelled = true;
    };
  }, [books]);

  useEffect(() => {
    if (!booksLoaded) fetchBooks();
    if (!videosLoaded) fetchVideos();
    if (!webLinksLoaded) fetchWebLinks();
    getApi().system.hostname().then(setHostname);
    getApi().settings.get(ONLY_THIS_HOST_SETTING_KEY).then((v) => setOnlyThisHost(v === 'on'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOnlyThisHost = (next: boolean) => {
    setOnlyThisHost(next);
    getApi().settings.set(ONLY_THIS_HOST_SETTING_KEY, next ? 'on' : 'off');
  };

  // A book synced to Drive but on another host still belongs in this list even with the filter
  // on — it's not "on this device" yet, but it's one Download tap away from being so. Without
  // this, the filter hid the exact books this feature exists for.
  const visibleBooks = useMemo(
    () => (onlyThisHost ? books.filter((b) => !b.hostname || b.hostname === hostname || !!b.driveFileId) : books),
    [books, onlyThisHost, hostname]
  );

  const openBookTapped = (book: Book) => {
    setOpenError(null);
    setReadingBook(book);
  };

  const downloadBookTapped = async (book: Book) => {
    if (!book.driveFileId) return;
    setOpenError(null);
    setDownloadingId(book.id);
    try {
      const result = await getApi().drive.downloadBookFile?.(book.driveFileId, book.id);
      if (!result?.ok || !result.filePath) {
        setOpenError(result?.error ?? 'Could not download this book.');
        return;
      }
      await updateBook(book.id, { filePath: result.filePath, hostname: await getApi().system.hostname() });
    } finally {
      setDownloadingId(null);
    }
  };

  // A Task's linked book/video (see GoalsView/TaskRow) sets this to jump straight to that item —
  // switch to its tab, remember its id to scroll+highlight it, then clear the signal so it only
  // fires once per navigation. Same pattern as desktop's LibraryScreen.
  useEffect(() => {
    if (!libraryFocus) return;
    setTab(libraryFocus.type === 'book' ? 'books' : 'videos');
    setHighlightId(libraryFocus.id);
    clearLibraryFocus();
  }, [libraryFocus, clearLibraryFocus]);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`library-${highlightId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId, tab]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted">
            {editMode ? 'Editing' : 'Quick-save anything to explore later.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant={editMode ? 'primary' : 'outline'} onClick={() => setEditMode((v) => !v)}>
            {editMode ? 'Done' : 'Edit'}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
          </Button>
        </div>
      </div>

      <div className="inline-flex w-full items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
        {(['books', 'videos', 'webLinks'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              tab === t ? 'bg-surface text-accentLibrary shadow-sm' : 'text-muted'
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <>
          {books.some((b) => b.hostname) && (
            <label className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-xs">
              <span className="text-muted">Only show PDFs added on this device</span>
              <Switch checked={onlyThisHost} onChange={toggleOnlyThisHost} label="Only this device's PDFs" />
            </label>
          )}
          {openError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{openError}</p>}
          <BooksList
            books={visibleBooks}
            hostname={hostname}
            highlightId={highlightId}
            editMode={editMode}
            downloadingId={downloadingId}
            missingFileIds={missingFileIds}
            onOpen={openBookTapped}
            onDownload={downloadBookTapped}
            onRemove={removeBook}
          />
        </>
      )}
      {tab === 'videos' && (
        <VideosList
          videos={videos}
          onEmptyAdd={() => setAddOpen(true)}
          highlightId={highlightId}
          editMode={editMode}
          onEdit={setEditingVideo}
        />
      )}
      {tab === 'webLinks' && (
        <WebLinksList webLinks={webLinks} onEmptyAdd={() => setAddOpen(true)} editMode={editMode} onEdit={setEditingWebLink} />
      )}

      {tab === 'books' && <NewBookDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {tab === 'videos' && <NewVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {tab === 'webLinks' && <NewWebLinkDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {editingVideo && <NewVideoDialog open onClose={() => setEditingVideo(null)} video={editingVideo} />}
      {editingWebLink && <NewWebLinkDialog open onClose={() => setEditingWebLink(null)} webLink={editingWebLink} />}
      {readingBook && <MobilePdfReaderScreen book={readingBook} onClose={() => setReadingBook(null)} />}
    </div>
  );
}

function BooksList({
  books,
  hostname,
  highlightId,
  editMode,
  downloadingId,
  missingFileIds,
  onOpen,
  onDownload,
  onRemove,
}: {
  books: Book[];
  hostname: string | null;
  highlightId: string | null;
  editMode: boolean;
  downloadingId: string | null;
  missingFileIds: Set<string>;
  onOpen: (book: Book) => void;
  onDownload: (book: Book) => void;
  onRemove: (id: string) => void;
}) {
  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={24} />}
        title="No books yet"
        description="Add a PDF from this device, share one in, or sync from desktop."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {books.map((b) => {
        const onOtherHost = b.hostname && hostname && b.hostname !== hostname;
        const fileMissing = !!b.filePath && missingFileIds.has(b.id);
        const openable = !!b.filePath && !onOtherHost && !fileMissing;
        return (
          <Card
            key={b.id}
            id={`library-${b.id}`}
            className={clsx('overflow-hidden transition-shadow', highlightId === b.id && 'ring-2 ring-accentLibrary')}
          >
            <button
              onClick={openable ? () => onOpen(b) : undefined}
              disabled={!openable}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-accentLibrary/25 via-accentLibrary/10 to-transparent p-3 text-center active:opacity-70"
            >
              {b.coverImage ? (
                <img src={b.coverImage} alt="" className="h-full w-full object-cover" />
              ) : onOtherHost ? (
                <FileWarning size={18} className="text-muted" />
              ) : (
                <>
                  <BookOpen size={18} className="text-accentLibrary" />
                  <span className="line-clamp-3 text-xs font-medium">{b.title}</span>
                </>
              )}
            </button>
            <div className="flex items-start justify-between gap-1 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug">{b.title}</p>
                {onOtherHost && !fileMissing && <p className="mt-1 truncate text-[10px] text-muted">on {b.hostname}</p>}
                {fileMissing && <p className="mt-1 truncate text-[10px] text-red-500">File missing on this device</p>}
                {!openable && !b.driveFileId && <p className="mt-1 truncate text-[10px] text-muted">No file linked</p>}
                {/* Gated on !openable, not !b.filePath — a book added on desktop already has a
                    filePath/hostname (the desktop machine's), so !b.filePath alone never catches
                    the actual common case: a desktop book with a driveFileId but on a different
                    host, which is exactly !openable. This was the real bug behind books synced
                    from desktop never showing a Download affordance on mobile at all. openable
                    also now folds in fileMissing — a book whose filePath points at a file that no
                    longer actually exists (app storage cleared, a reinstall that only brought the
                    database back via Drive sync and not the PDF bytes) looked "openable" by
                    filePath/hostname alone and would just fail; this makes it redownloadable
                    instead, same as a book that was never downloaded here at all. */}
                {!openable && b.driveFileId && (
                  <button
                    onClick={() => onDownload(b)}
                    disabled={downloadingId === b.id}
                    className="mt-1 flex items-center gap-1 text-[10px] font-medium text-accentLibrary disabled:opacity-50"
                  >
                    <Download size={11} /> {downloadingId === b.id ? 'Downloading…' : fileMissing ? 'Download again' : 'Download'}
                  </button>
                )}
              </div>
              {editMode && (
                <button onClick={() => onRemove(b.id)} className="shrink-0 text-muted active:text-red-500">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function VideosList({
  videos,
  onEmptyAdd,
  highlightId,
  editMode,
  onEdit,
}: {
  videos: Video[];
  onEmptyAdd: () => void;
  highlightId: string | null;
  editMode: boolean;
  onEdit: (video: Video) => void;
}) {
  const { removeVideo, updateVideo } = useVideosStore();
  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<Play size={24} />}
        title="No videos yet"
        description="Paste a YouTube link — thumbnail fetched automatically."
        action={
          <Button size="sm" onClick={onEmptyAdd}>
            <Plus size={14} /> Add
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {videos.map((v) => (
        <Card
          key={v.id}
          id={`library-${v.id}`}
          className={clsx('flex gap-3 p-2.5 transition-shadow', highlightId === v.id && 'ring-2 ring-accentLibrary')}
        >
          <button onClick={() => getApi().system.openExternal(v.url)} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-background">
            {v.thumbnail ? (
              <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accentLibrary/10">
                <Play size={16} className="text-accentLibrary" />
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</p>
            <select
              value={v.status}
              onChange={(e) => updateVideo(v.id, { status: e.target.value as VideoStatus })}
              className="mt-1 w-fit rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]"
            >
              <option value="to-watch">To watch</option>
              <option value="watching">Watching</option>
              <option value="watched">Watched</option>
            </select>
          </div>
          {editMode && (
            <div className="flex shrink-0 flex-col gap-2 self-start">
              <button onClick={() => onEdit(v)} className="text-muted active:text-foreground">
                <Pencil size={13} />
              </button>
              <button onClick={() => removeVideo(v.id)} className="text-muted active:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function WebLinksList({
  webLinks,
  onEmptyAdd,
  editMode,
  onEdit,
}: {
  webLinks: WebLink[];
  onEmptyAdd: () => void;
  editMode: boolean;
  onEdit: (webLink: WebLink) => void;
}) {
  const { removeWebLink, updateWebLink } = useWebLinksStore();
  if (webLinks.length === 0) {
    return (
      <EmptyState
        icon={<Globe size={24} />}
        title="No web links yet"
        description="Save an article URL — preview fetched automatically."
        action={
          <Button size="sm" onClick={onEmptyAdd}>
            <Plus size={14} /> Add
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {webLinks.map((link) => (
        <Card key={link.id} className="flex gap-3 p-2.5">
          <button onClick={() => getApi().system.openExternal(link.url)} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-background">
            {link.previewImage ? (
              <img src={link.previewImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accentLibrary/10">
                {link.favicon ? <img src={link.favicon} alt="" className="h-5 w-5" /> : <Globe size={16} className="text-accentLibrary" />}
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{link.title}</p>
            <select
              value={link.status}
              onChange={(e) => updateWebLink(link.id, { status: e.target.value as WebLinkStatus })}
              className="mt-1 w-fit rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]"
            >
              <option value="to-explore">To explore</option>
              <option value="explored">Explored</option>
            </select>
          </div>
          {editMode && (
            <div className="flex shrink-0 flex-col gap-2 self-start">
              <button onClick={() => onEdit(link)} className="text-muted active:text-foreground">
                <Pencil size={13} />
              </button>
              <button onClick={() => removeWebLink(link.id)} className="text-muted active:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function NewBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addBook } = useBooksStore();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setFile(null);
    setError(null);
  };

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = () => {
      const picked = input.files?.[0];
      if (picked) {
        setFile(picked);
        if (!title.trim()) setTitle(picked.name.replace(/\.pdf$/i, ''));
      }
    };
    input.click();
  };

  const submit = async () => {
    if (!title.trim() || !file) return;
    setSaving(true);
    setError(null);
    try {
      // Copied into app-private storage (Directory.Data) rather than trusting the picker's
      // content:// URI to stay valid long-term — Android scoped-storage permissions on a
      // one-off pick aren't guaranteed reusable across app restarts.
      const base64 = await readFileAsBase64(file);
      const fileName = `book-${Date.now()}.pdf`;
      await Filesystem.writeFile({ path: fileName, directory: Directory.Data, data: base64 });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Data });
      const filePath = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
      await addBook({ title: title.trim(), filePath });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add a PDF">
      <div className="space-y-3">
        <Field label="PDF file">
          <Button variant="outline" size="sm" onClick={pickFile} type="button">
            <Upload size={14} /> {file ? file.name : 'Choose PDF'}
          </Button>
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep Work" />
        </Field>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-[11px] text-muted">
          Saved to this device only — the "on {'{device}'}" caption on other devices reflects where it opens from.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || !file || saving}>
            {saving ? 'Saving…' : 'Add book'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// Doubles as the edit dialog when a `video` prop is passed — same dual-purpose pattern desktop's
// TaskDialog/SlotDialog use. Editing a video only has a title (URL/kind aren't re-fetchable-safe
// to change in place — thumbnail/kind were set from the original URL), so the URL/playlist fields
// only render in add mode.
function NewVideoDialog({ open, onClose, video }: { open: boolean; onClose: () => void; video?: Video }) {
  const { addVideo, updateVideo } = useVideosStore();
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<VideoKind>('video');
  const [title, setTitle] = useState(video?.title ?? '');
  const [fetching, setFetching] = useState(false);

  const submit = async () => {
    if (video) {
      if (!title.trim()) return;
      await updateVideo(video.id, { title: title.trim() });
      onClose();
      return;
    }
    if (!url.trim()) return;
    setFetching(true);
    await addVideo({ url: url.trim(), kind });
    setFetching(false);
    setUrl('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={video ? 'Edit video' : 'New video'}>
      <div className="space-y-3">
        {video ? (
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
        ) : (
          <>
            <Field label="YouTube URL (video or playlist)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." autoFocus />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kind === 'playlist'} onChange={(e) => setKind(e.target.checked ? 'playlist' : 'video')} />
              This is a playlist
            </label>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={video ? !title.trim() : !url.trim() || fetching}>
            {video ? 'Save' : fetching ? 'Fetching…' : 'Add video'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// Doubles as the edit dialog when a `webLink` prop is passed. Editing keeps the URL fixed (re-
// fetching a new preview in place isn't worth the complexity for this pass) and only lets title/
// notes change.
function NewWebLinkDialog({ open, onClose, webLink }: { open: boolean; onClose: () => void; webLink?: WebLink }) {
  const { addWebLink, updateWebLink } = useWebLinksStore();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState(webLink?.title ?? '');
  const [notes, setNotes] = useState(webLink?.notes ?? '');
  const [fetching, setFetching] = useState(false);

  const submit = async () => {
    if (webLink) {
      await updateWebLink(webLink.id, { title: title.trim() || webLink.title, notes: notes.trim() || null });
      onClose();
      return;
    }
    if (!url.trim()) return;
    setFetching(true);
    await addWebLink(url.trim(), title.trim(), notes.trim() || null);
    setFetching(false);
    setUrl('');
    setTitle('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={webLink ? 'Edit web link' : 'New web link'}>
      <div className="space-y-3">
        {!webLink && (
          <Field label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus />
          </Field>
        )}
        <Field label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!!webLink} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!webLink && (!url.trim() || fetching)}>
            {webLink ? 'Save' : fetching ? 'Fetching…' : 'Add web link'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
