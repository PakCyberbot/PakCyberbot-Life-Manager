import { create } from 'zustand';
import { newId, nowIso, type Book } from '@life-manager/shared';
import { getApi } from '../api';
import { useSettingsStore } from './useSettingsStore';

export interface NewBookInput {
  title: string;
  filePath?: string | null;
}

interface BooksState {
  books: Book[];
  loading: boolean;
  loaded: boolean;
  subscribed: boolean;
  fetchBooks: () => Promise<void>;
  addBook: (input: NewBookInput) => Promise<Book>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  setBookmark: (id: string, page: number) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  /** Opens the in-app viewer; bookmark updates on close arrive via the subscription below. */
  openBook: (book: Book) => Promise<{ ok: boolean; error?: string }>;
  /** Opens the configured external reader (or OS default) instead — no automatic bookmark tracking. */
  openBookExternally: (book: Book) => Promise<{ ok: boolean; error?: string }>;
  /** Wires up the main-process push channel that reports bookmarks captured by the in-app viewer. Call once. */
  subscribeToBookmarkUpdates: () => void;
}

export const useBooksStore = create<BooksState>((set, get) => ({
  books: [],
  loading: false,
  loaded: false,
  subscribed: false,

  async fetchBooks() {
    set({ loading: true });
    const books = await getApi().db.list<Book>('books');
    set({ books, loading: false, loaded: true });
  },

  async addBook(input) {
    const hostname = input.filePath ? await getApi().system.hostname() : null;
    const book: Book = {
      id: newId(),
      title: input.title,
      filePath: input.filePath ?? null,
      hostname,
      coverImage: null,
      bookmarkPage: 1,
      status: 'to-read',
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('books', book);
    set({ books: [book, ...get().books] });
    return book;
  },

  async updateBook(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('books', id, { ...patch, updatedAt });
    set({ books: get().books.map((b) => (b.id === id ? { ...b, ...patch, updatedAt } : b)) });
  },

  async setBookmark(id, page) {
    await get().updateBook(id, { bookmarkPage: Math.max(1, Math.round(page)) });
  },

  async removeBook(id) {
    await getApi().db.remove('books', id);
    set({ books: get().books.filter((b) => b.id !== id) });
  },

  async openBook(book) {
    if (!book.filePath) return { ok: false, error: 'No file path set for this book.' };
    return getApi().system.openBookInApp({ id: book.id, filePath: book.filePath, page: book.bookmarkPage });
  },

  async openBookExternally(book) {
    if (!book.filePath) return { ok: false, error: 'No file path set for this book.' };
    const { readerPath } = useSettingsStore.getState();
    return getApi().system.openBookExternally({ filePath: book.filePath, page: book.bookmarkPage, readerPath });
  },

  subscribeToBookmarkUpdates() {
    if (get().subscribed) return;
    set({ subscribed: true });
    getApi().system.onBookmarkUpdate(({ id, page }) => {
      // The main process already wrote this to the DB — just reflect it locally.
      set({
        books: get().books.map((b) => (b.id === id ? { ...b, bookmarkPage: page, updatedAt: nowIso() } : b)),
      });
    });
  },
}));
