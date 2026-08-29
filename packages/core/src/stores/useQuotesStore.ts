import { create } from 'zustand';
import { newId, nowIso, type Quote } from '@life-manager/shared';
import { getApi } from '../api';

interface QuotesState {
  quotes: Quote[];
  loading: boolean;
  loaded: boolean;
  fetchQuotes: () => Promise<void>;
  addQuote: (text: string, author?: string | null) => Promise<void>;
  removeQuote: (id: string) => Promise<void>;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  loading: false,
  loaded: false,

  async fetchQuotes() {
    set({ loading: true });
    const quotes = await getApi().db.list<Quote>('quotes');
    set({ quotes, loading: false, loaded: true });
  },

  async addQuote(text, author) {
    const quote: Quote = {
      id: newId(),
      text,
      author: author?.trim() || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('quotes', quote);
    set({ quotes: [quote, ...get().quotes] });
  },

  async removeQuote(id) {
    await getApi().db.remove('quotes', id);
    set({ quotes: get().quotes.filter((q) => q.id !== id) });
  },
}));

/** Picks a random quote — used by the Dashboard's quote-of-the-moment card. */
export function pickRandomQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  return quotes[Math.floor(Math.random() * quotes.length)];
}
