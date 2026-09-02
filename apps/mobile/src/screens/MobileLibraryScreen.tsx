import { useEffect, useState } from 'react';
import { BookOpen, Globe, Play, Plus, Trash2 } from 'lucide-react';
import { getApi, useBooksStore, useUiFocusStore, useVideosStore, useWebLinksStore } from '@life-manager/core';
import type { Book, VideoKind, WebLinkStatus, VideoStatus, Video, WebLink } from '@life-manager/shared';
import { Card, Badge, Button, Dialog, Field, Input, Textarea, EmptyState } from '@life-manager/ui';
import clsx from 'clsx';

type Tab = 'books' | 'videos' | 'webLinks';
const TAB_LABEL: Record<Tab, string> = { books: 'Books', videos: 'Videos', webLinks: 'Web links' };

// The one editable section on mobile — same three Library tabs as desktop,
// rebuilt single-column for a phone (not a port of desktop's LibraryScreen,
// which assumes a wide multi-column grid and native file-picker dialogs).
// Books show whatever's synced/share-intent-added (Phase 2) — no manual add
// here, mirroring desktop's own host-gating: a book only opens on the device
// it belongs to.
export function MobileLibraryScreen() {
  const [tab, setTab] = useState<Tab>('books');
  const { books, fetchBooks, loaded: booksLoaded } = useBooksStore();
  const { videos, fetchVideos, loaded: videosLoaded } = useVideosStore();
  const { webLinks, fetchWebLinks, loaded: webLinksLoaded } = useWebLinksStore();
  const [hostname, setHostname] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const { libraryFocus, clearLibraryFocus } = useUiFocusStore();

  useEffect(() => {
    if (!booksLoaded) fetchBooks();
    if (!videosLoaded) fetchVideos();
    if (!webLinksLoaded) fetchWebLinks();
    getApi().system.hostname().then(setHostname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="mt-1 text-sm text-muted">Quick-save anything to explore later.</p>
        </div>
        {tab !== 'books' && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
          </Button>
        )}
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

      {tab === 'books' && <BooksList books={books} hostname={hostname} highlightId={highlightId} />}
      {tab === 'videos' && <VideosList videos={videos} onEmptyAdd={() => setAddOpen(true)} highlightId={highlightId} />}
      {tab === 'webLinks' && <WebLinksList webLinks={webLinks} onEmptyAdd={() => setAddOpen(true)} />}

      {tab === 'videos' && <NewVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {tab === 'webLinks' && <NewWebLinkDialog open={addOpen} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function BooksList({ books, hostname, highlightId }: { books: Book[]; hostname: string | null; highlightId: string | null }) {
  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={24} />}
        title="No books yet"
        description="Share a PDF into this app (coming soon), or sync from desktop."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {books.map((b) => {
        const onOtherHost = b.hostname && hostname && b.hostname !== hostname;
        return (
          <Card
            key={b.id}
            id={`library-${b.id}`}
            className={clsx('overflow-hidden transition-shadow', highlightId === b.id && 'ring-2 ring-accentLibrary')}
          >
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-accentLibrary/25 via-accentLibrary/10 to-transparent p-3 text-center">
              {b.coverImage ? (
                <img src={b.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <BookOpen size={18} className="text-accentLibrary" />
                  <span className="line-clamp-3 text-xs font-medium">{b.title}</span>
                </>
              )}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-xs font-medium leading-snug">{b.title}</p>
              {onOtherHost && <p className="mt-1 truncate text-[10px] text-muted">on {b.hostname}</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function VideosList({ videos, onEmptyAdd, highlightId }: { videos: Video[]; onEmptyAdd: () => void; highlightId: string | null }) {
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
          <button onClick={() => removeVideo(v.id)} className="shrink-0 self-start text-muted active:text-red-500">
            <Trash2 size={14} />
          </button>
        </Card>
      ))}
    </div>
  );
}

function WebLinksList({ webLinks, onEmptyAdd }: { webLinks: WebLink[]; onEmptyAdd: () => void }) {
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
          <button onClick={() => removeWebLink(link.id)} className="shrink-0 self-start text-muted active:text-red-500">
            <Trash2 size={14} />
          </button>
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={kind === 'playlist'} onChange={(e) => setKind(e.target.checked ? 'playlist' : 'video')} />
          This is a playlist
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!url.trim() || fetching}>
            {fetching ? 'Fetching…' : 'Add video'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function NewWebLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addWebLink } = useWebLinksStore();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [fetching, setFetching] = useState(false);

  const submit = async () => {
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
    <Dialog open={open} onClose={onClose} title="New web link">
      <div className="space-y-3">
        <Field label="URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus />
        </Field>
        <Field label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!url.trim() || fetching}>
            {fetching ? 'Fetching…' : 'Add web link'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
