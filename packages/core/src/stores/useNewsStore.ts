import { create } from 'zustand';
import { newId, nowIso, type NewsCategory, type NewsItem } from '@life-manager/shared';
import { getApi } from '../api';

interface NewsState {
  categories: NewsCategory[];
  itemsByCategory: Record<string, NewsItem[]>;
  loadingByCategory: Record<string, boolean>;
  errorByCategory: Record<string, string | null>;
  loaded: boolean;

  fetchCategories: () => Promise<void>;
  fetchCachedItems: (categoryId: string) => Promise<void>;
  addCustomCategory: (name: string, prompt: string) => Promise<void>;
  /** Adds a 'blog' category (a live site preview, no RSS/AI digest) and immediately fetches its preview. */
  addBlogCategory: (url: string, name?: string) => Promise<void>;
  updateCategory: (id: string, patch: Partial<NewsCategory>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  /** Calls out to the RSS + AI pipeline in main and refreshes this category's items — for 'blog'
   * categories this instead re-fetches the site's preview image/title/favicon. */
  refreshCategory: (id: string) => Promise<void>;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  categories: [],
  itemsByCategory: {},
  loadingByCategory: {},
  errorByCategory: {},
  loaded: false,

  async fetchCategories() {
    const categories = await getApi().db.list<NewsCategory>('newsCategories');
    set({ categories, loaded: true });
  },

  async fetchCachedItems(categoryId) {
    const items = await getApi().db.list<NewsItem>('newsItems', { categoryId });
    set({ itemsByCategory: { ...get().itemsByCategory, [categoryId]: items } });
  },

  async addCustomCategory(name, prompt) {
    const category: NewsCategory = {
      id: newId(),
      type: 'custom',
      name,
      prompt,
      locationValue: null,
      lastFetchedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('newsCategories', category);
    set({ categories: [category, ...get().categories] });
  },

  async addBlogCategory(url, name) {
    const category: NewsCategory = {
      id: newId(),
      type: 'blog',
      // Falls back to the URL itself as a placeholder — news:fetch's blog branch only overwrites
      // the name once a real og:title comes back, and only while it's still this placeholder.
      name: name?.trim() || url,
      prompt: null,
      locationValue: null,
      url,
      previewImage: null,
      previewFavicon: null,
      lastFetchedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('newsCategories', category);
    set({ categories: [category, ...get().categories] });
    await get().refreshCategory(category.id);
  },

  async updateCategory(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('newsCategories', id, { ...patch, updatedAt });
    set({ categories: get().categories.map((c) => (c.id === id ? { ...c, ...patch, updatedAt } : c)) });
  },

  async removeCategory(id) {
    const category = get().categories.find((c) => c.id === id);
    // Blog categories carry a fetched data: URI preview image — same cleanup rationale as
    // Library books/videos, so they're hard-deleted rather than soft-deleted like every other type.
    if (category?.type === 'blog') {
      await getApi().db.hardRemove('newsCategories', id);
    } else {
      await getApi().db.remove('newsCategories', id);
    }
    set({ categories: get().categories.filter((c) => c.id !== id) });
  },

  async refreshCategory(id) {
    set({
      loadingByCategory: { ...get().loadingByCategory, [id]: true },
      errorByCategory: { ...get().errorByCategory, [id]: null },
    });
    const result = await getApi().news.fetch(id);
    if (result.ok) {
      const updatedCategory = result.category as NewsCategory | undefined;
      set({
        itemsByCategory: { ...get().itemsByCategory, [id]: (result.items as NewsItem[]) ?? [] },
        categories: get().categories.map((c) => (c.id === id ? { ...c, ...(updatedCategory ?? { lastFetchedAt: nowIso() }) } : c)),
      });
    } else {
      set({ errorByCategory: { ...get().errorByCategory, [id]: result.error ?? 'Could not fetch news.' } });
    }
    set({ loadingByCategory: { ...get().loadingByCategory, [id]: false } });
  },
}));
