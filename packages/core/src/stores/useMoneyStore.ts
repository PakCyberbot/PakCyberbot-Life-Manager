import { create } from 'zustand';
import {
  newId,
  nowIso,
  type SavingsEntry,
  type SavingsEntryType,
  type WishlistCategory,
  type WishlistItem,
  type WishlistStatus,
} from '@life-manager/shared';
import { getApi } from '../api';

// Money, simplified to a personal savings total + a wishlist — see
// structure.md's Money section for why the original full accounts/
// transactions/budgets model was replaced.

export interface NewSavingsEntryInput {
  amount: number;
  type: SavingsEntryType;
  note?: string | null;
  date: string;
}

export interface NewWishlistItemInput {
  title: string;
  category: WishlistCategory;
  estimatedCost?: number | null;
  notes?: string | null;
}

interface MoneyState {
  entries: SavingsEntry[];
  wishlist: WishlistItem[];
  loading: boolean;
  loaded: boolean;
  fetchAll: () => Promise<void>;

  addEntry: (input: NewSavingsEntryInput) => Promise<void>;
  updateEntry: (id: string, patch: Partial<SavingsEntry>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;

  addWishlistItem: (input: NewWishlistItemInput) => Promise<void>;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  setWishlistStatus: (id: string, status: WishlistStatus) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
}

export const useMoneyStore = create<MoneyState>((set, get) => ({
  entries: [],
  wishlist: [],
  loading: false,
  loaded: false,

  async fetchAll() {
    set({ loading: true });
    const [entries, wishlist] = await Promise.all([
      getApi().db.list<SavingsEntry>('savingsEntries'),
      getApi().db.list<WishlistItem>('wishlistItems'),
    ]);
    set({ entries, wishlist, loading: false, loaded: true });
  },

  async addEntry(input) {
    const entry: SavingsEntry = {
      id: newId(),
      amount: input.amount,
      type: input.type,
      note: input.note ?? null,
      date: input.date,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('savingsEntries', entry);
    set({ entries: [entry, ...get().entries] });
  },

  async updateEntry(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('savingsEntries', id, { ...patch, updatedAt });
    set({ entries: get().entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt } : e)) });
  },

  async removeEntry(id) {
    await getApi().db.remove('savingsEntries', id);
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },

  async addWishlistItem(input) {
    const item: WishlistItem = {
      id: newId(),
      title: input.title,
      category: input.category,
      estimatedCost: input.estimatedCost ?? null,
      notes: input.notes ?? null,
      status: 'planned',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('wishlistItems', item);
    set({ wishlist: [item, ...get().wishlist] });
  },

  async updateWishlistItem(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('wishlistItems', id, { ...patch, updatedAt });
    set({ wishlist: get().wishlist.map((w) => (w.id === id ? { ...w, ...patch, updatedAt } : w)) });
  },

  async setWishlistStatus(id, status) {
    await get().updateWishlistItem(id, { status });
  },

  async removeWishlistItem(id) {
    await getApi().db.remove('wishlistItems', id);
    set({ wishlist: get().wishlist.filter((w) => w.id !== id) });
  },
}));

/** Total savings = signed sum of every entry (add − expense). */
export function computeTotalSavings(entries: SavingsEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.type === 'expense' ? -e.amount : e.amount), 0);
}
