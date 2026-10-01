import { create } from 'zustand';
import { newId, nowIso, type WebLink, type WebLinkReadLength } from '@life-manager/shared';
import { getApi } from '../api';

interface WebLinksState {
  webLinks: WebLink[];
  loading: boolean;
  loaded: boolean;
  /** ids currently waiting on a fetched preview — lets the UI show a per-card "fetching" state. */
  pendingPreviewIds: Set<string>;

  fetchWebLinks: () => Promise<void>;
  /** Creates the row immediately, then fills in the preview image/favicon (and title, if not user-set) asynchronously once it lands. `readLength` defaults to 'short' — the same default the database column itself falls back to for pre-existing rows. */
  addWebLink: (url: string, title?: string, notes?: string | null, readLength?: WebLinkReadLength) => Promise<WebLink>;
  updateWebLink: (id: string, patch: Partial<WebLink>) => Promise<void>;
  removeWebLink: (id: string) => Promise<void>;
}

export const useWebLinksStore = create<WebLinksState>((set, get) => ({
  webLinks: [],
  loading: false,
  loaded: false,
  pendingPreviewIds: new Set(),

  async fetchWebLinks() {
    set({ loading: true });
    const webLinks = await getApi().db.list<WebLink>('webLinks');
    set({ webLinks, loading: false, loaded: true });
  },

  async addWebLink(url, title, notes, readLength) {
    const userTitle = title?.trim();
    const link: WebLink = {
      id: newId(),
      title: userTitle || url,
      url,
      previewImage: null,
      favicon: null,
      notes: notes ?? null,
      status: 'to-explore',
      readLength: readLength ?? 'short',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('webLinks', link);
    set({ webLinks: [link, ...get().webLinks] });

    const pending = new Set(get().pendingPreviewIds);
    pending.add(link.id);
    set({ pendingPreviewIds: pending });

    const preview = await getApi()
      .media.fetchWebPreview(url)
      .catch(() => null);

    const stillPending = new Set(get().pendingPreviewIds);
    stillPending.delete(link.id);
    set({ pendingPreviewIds: stillPending });

    if (preview) {
      const patch: Partial<WebLink> = {
        previewImage: preview.image,
        favicon: preview.favicon,
        // A manually typed title always wins; otherwise use the page's own title once it's fetched.
        ...(userTitle ? {} : preview.title ? { title: preview.title } : {}),
      };
      const updatedAt = nowIso();
      await getApi().db.update('webLinks', link.id, { ...patch, updatedAt });
      set({ webLinks: get().webLinks.map((l) => (l.id === link.id ? { ...l, ...patch, updatedAt } : l)) });
    }

    return link;
  },

  async updateWebLink(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('webLinks', id, { ...patch, updatedAt });
    set({ webLinks: get().webLinks.map((l) => (l.id === id ? { ...l, ...patch, updatedAt } : l)) });
  },

  async removeWebLink(id) {
    // Hard delete, not soft: a web link can carry a sizable data: URI preview image/favicon,
    // and there's no "undo" value in keeping a deleted link's row around — same as books/videos.
    await getApi().db.hardRemove('webLinks', id);
    set({ webLinks: get().webLinks.filter((l) => l.id !== id) });
  },
}));
