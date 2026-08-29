import { create } from 'zustand';
import { newId, nowIso, type FileCategory, type FileLink } from '@life-manager/shared';
import { getApi } from '../api';

interface FileManagerState {
  categories: FileCategory[];
  links: FileLink[];
  hostname: string | null;
  loaded: boolean;

  fetchAll: () => Promise<void>;
  addCategory: (name: string, parentId: string | null) => Promise<void>;
  /** Soft-deletes the category, every descendant category, and every link inside any of them. */
  removeCategory: (id: string) => Promise<void>;
  addLink: (categoryId: string, label: string, path: string, isFolder: boolean) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  /** No-ops (never even calls out) if the link's hostname doesn't match this machine's — that mismatch is the point, not a bug to work around. */
  openLink: (link: FileLink) => Promise<{ ok: boolean; error?: string }>;
}

function collectDescendantIds(categories: FileCategory[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  categories: [],
  links: [],
  hostname: null,
  loaded: false,

  async fetchAll() {
    const [categories, links, hostname] = await Promise.all([
      getApi().db.list<FileCategory>('fileCategories'),
      getApi().db.list<FileLink>('fileLinks'),
      getApi().system.hostname(),
    ]);
    set({ categories, links, hostname, loaded: true });
  },

  async addCategory(name, parentId) {
    const category: FileCategory = {
      id: newId(),
      name,
      parentId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('fileCategories', category);
    set({ categories: [category, ...get().categories] });
  },

  async removeCategory(id) {
    const toRemove = collectDescendantIds(get().categories, id);
    const linksToRemove = get().links.filter((l) => toRemove.has(l.categoryId));
    await Promise.all([
      ...[...toRemove].map((catId) => getApi().db.remove('fileCategories', catId)),
      ...linksToRemove.map((l) => getApi().db.remove('fileLinks', l.id)),
    ]);
    set({
      categories: get().categories.filter((c) => !toRemove.has(c.id)),
      links: get().links.filter((l) => !toRemove.has(l.categoryId)),
    });
  },

  async addLink(categoryId, label, path, isFolder) {
    const hostname = get().hostname ?? (await getApi().system.hostname());
    const link: FileLink = {
      id: newId(),
      categoryId,
      label,
      path,
      isFolder: isFolder ? 1 : 0,
      hostname,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('fileLinks', link);
    set({ links: [link, ...get().links] });
  },

  async removeLink(id) {
    await getApi().db.remove('fileLinks', id);
    set({ links: get().links.filter((l) => l.id !== id) });
  },

  async openLink(link) {
    if (link.hostname !== get().hostname) {
      return { ok: false, error: `Only available on ${link.hostname}.` };
    }
    return getApi().system.openLocalPath(link.path);
  },
}));
