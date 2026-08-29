import { create } from 'zustand';
import { newId, nowIso, type Entertainment, type EntertainmentType } from '@life-manager/shared';
import { getApi } from '../api';

interface EntertainmentState {
  items: Entertainment[];
  loading: boolean;
  loaded: boolean;
  /** ids currently waiting on an AI verdict — lets the UI show a per-card "thinking" state. */
  pendingVerdictIds: Set<string>;

  fetchItems: () => Promise<void>;
  /** Creates the row immediately, then fills in the AI verdict asynchronously once it lands. */
  addItem: (title: string, type: EntertainmentType, thumbnailUrl?: string | null) => Promise<void>;
  updateStatus: (id: string, status: Entertainment['status']) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

export const useEntertainmentStore = create<EntertainmentState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  pendingVerdictIds: new Set(),

  async fetchItems() {
    set({ loading: true });
    const items = await getApi().db.list<Entertainment>('entertainment');
    set({ items, loading: false, loaded: true });
  },

  async addItem(title, type, thumbnailUrl) {
    // Best-effort — a bad/unreachable image URL just leaves no thumbnail,
    // never blocks adding the item itself.
    const thumbnail = thumbnailUrl ? await getApi().media.fetchImageAsDataUri(thumbnailUrl).catch(() => null) : null;
    const item: Entertainment = {
      id: newId(),
      title,
      type,
      status: 'considering',
      verdict: null,
      reasoning: null,
      skillsImproved: null,
      benefits: null,
      timeCostEstimate: null,
      addictiveness: null,
      mentalEffects: null,
      aiGeneratedAt: null,
      aiProvider: null,
      notes: null,
      thumbnail,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('entertainment', item);
    set({ items: [item, ...get().items] });

    // Fire-and-forget: the card is already visible, verdict fields populate when ready.
    const pending = new Set(get().pendingVerdictIds);
    pending.add(item.id);
    set({ pendingVerdictIds: pending });

    const result = await getApi().entertainment.generateVerdict(title, type);
    const stillPending = new Set(get().pendingVerdictIds);
    stillPending.delete(item.id);
    set({ pendingVerdictIds: stillPending });

    if (result.ok && result.verdict) {
      const patch: Partial<Entertainment> = {
        verdict: result.verdict.verdict,
        reasoning: result.verdict.reasoning,
        skillsImproved: result.verdict.skillsImproved,
        benefits: result.verdict.benefits,
        timeCostEstimate: result.verdict.timeCostEstimate,
        addictiveness: result.verdict.addictiveness,
        mentalEffects: result.verdict.mentalEffects,
        aiGeneratedAt: nowIso(),
        aiProvider: result.provider ?? null,
      };
      const updatedAt = nowIso();
      await getApi().db.update('entertainment', item.id, { ...patch, updatedAt });
      set({ items: get().items.map((i) => (i.id === item.id ? { ...i, ...patch, updatedAt } : i)) });
    }
  },

  async updateStatus(id, status) {
    const updatedAt = nowIso();
    await getApi().db.update('entertainment', id, { status, updatedAt });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, status, updatedAt } : i)) });
  },

  async updateNotes(id, notes) {
    const updatedAt = nowIso();
    await getApi().db.update('entertainment', id, { notes, updatedAt });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, notes, updatedAt } : i)) });
  },

  async removeItem(id) {
    await getApi().db.remove('entertainment', id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));
