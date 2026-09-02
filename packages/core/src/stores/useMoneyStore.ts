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

  addEntry: (input: NewSavingsEntryInput) => Promise<SavingsEntry>;
  updateEntry: (id: string, patch: Partial<SavingsEntry>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;

  addWishlistItem: (input: NewWishlistItemInput) => Promise<void>;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  /** Edits a wishlist item's own fields — and, if the cost changes on an already-'done' item, keeps
   * its linked savings transaction's amount in sync (the item was cheaper/pricier than estimated). */
  editWishlistItem: (id: string, patch: NewWishlistItemInput) => Promise<void>;
  /** Marking 'done' (with a cost set) creates a matching savings expense entry; leaving 'done' (back to
   * planned, or cancelled) removes that exact entry again — see structure.md's Money section. */
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
    return entry;
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
      purchaseEntryId: null,
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

  async editWishlistItem(id, patch) {
    const item = get().wishlist.find((w) => w.id === id);
    await get().updateWishlistItem(id, {
      title: patch.title,
      category: patch.category,
      estimatedCost: patch.estimatedCost ?? null,
      notes: patch.notes ?? null,
    });
    // Purchased, and the price turned out cheaper/pricier than estimated — keep the already-deducted
    // transaction honest rather than leaving it at the old estimate.
    if (item?.status === 'done' && item.purchaseEntryId && patch.estimatedCost != null) {
      await get().updateEntry(item.purchaseEntryId, { amount: patch.estimatedCost });
    }
  },

  async setWishlistStatus(id, status) {
    const item = get().wishlist.find((w) => w.id === id);
    if (!item) return;

    if (status === 'done' && item.status !== 'done') {
      if (item.purchaseEntryId) {
        // Already linked (shouldn't normally happen — leaving 'done' clears it) — just flip status.
        await get().updateWishlistItem(id, { status });
        return;
      }
      if (item.estimatedCost && item.estimatedCost > 0) {
        const entry = await get().addEntry({
          amount: item.estimatedCost,
          type: 'expense',
          note: `Purchased: ${item.title}`,
          date: nowIso().slice(0, 10),
        });
        await get().updateWishlistItem(id, { status, purchaseEntryId: entry.id });
      } else {
        // Nothing to deduct — no cost was ever set.
        await get().updateWishlistItem(id, { status });
      }
      return;
    }

    if (status !== 'done' && item.status === 'done' && item.purchaseEntryId) {
      // Leaving 'done' (back to planned, or cancelled) undoes the deduction — no phantom transaction
      // should survive the item no longer being marked purchased.
      await get().removeEntry(item.purchaseEntryId);
      await get().updateWishlistItem(id, { status, purchaseEntryId: null });
      return;
    }

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
