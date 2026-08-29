import { create } from 'zustand';
import { newId, nowIso, type EarningWay, type EarningWayCategory } from '@life-manager/shared';
import { getApi, type EarningWaySuggestionPayload } from '../api';

interface EarningWaysState {
  items: EarningWay[];
  loading: boolean;
  loaded: boolean;
  suggestions: EarningWaySuggestionPayload[];
  suggesting: boolean;
  suggestError: string | null;
  guideLoadingIds: Set<string>;

  fetchItems: () => Promise<void>;
  addItem: (
    title: string,
    category: EarningWayCategory,
    notes?: string | null,
    source?: EarningWay['source']
  ) => Promise<void>;
  updateStatus: (id: string, status: EarningWay['status']) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;

  fetchSuggestions: () => Promise<void>;
  addSuggestion: (suggestion: EarningWaySuggestionPayload) => Promise<void>;
  dismissSuggestion: (suggestion: EarningWaySuggestionPayload) => void;

  /** Generates the guide if not already cached; no-ops otherwise. */
  ensureGuide: (id: string) => Promise<void>;
  /** Force-regenerates even if a guide is already cached. */
  regenerateGuide: (id: string) => Promise<void>;
}

async function runGuideGeneration(
  get: () => EarningWaysState,
  set: (partial: Partial<EarningWaysState>) => void,
  id: string
) {
  const item = get().items.find((i) => i.id === id);
  if (!item) return;

  const pending = new Set(get().guideLoadingIds);
  pending.add(id);
  set({ guideLoadingIds: pending });

  const result = await getApi().earningWays.generateGuide(item.title, item.category);

  const stillPending = new Set(get().guideLoadingIds);
  stillPending.delete(id);
  set({ guideLoadingIds: stillPending });

  if (result.ok && result.guide) {
    const updatedAt = nowIso();
    const patch: Partial<EarningWay> = {
      guideOverview: result.guide.overview,
      guideSteps: result.guide.gettingStartedSteps,
      guideSkillsNeeded: result.guide.skillsNeeded,
      guideTools: result.guide.toolsPlatforms,
      guideTimeline: result.guide.timelineExpectation,
      guideIncomePotential: result.guide.incomePotential,
      guidePitfalls: result.guide.commonPitfalls,
      guideResources: result.guide.resources,
      guideGeneratedAt: updatedAt,
      guideProvider: result.provider ?? null,
    };
    await getApi().db.update('earningWays', id, { ...patch, updatedAt });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt } : i)) });
  }
}

export const useEarningWaysStore = create<EarningWaysState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  suggestions: [],
  suggesting: false,
  suggestError: null,
  guideLoadingIds: new Set(),

  async fetchItems() {
    set({ loading: true });
    const items = await getApi().db.list<EarningWay>('earningWays');
    set({ items, loading: false, loaded: true });
  },

  async addItem(title, category, notes, source = 'user') {
    const item: EarningWay = {
      id: newId(),
      title,
      category,
      status: 'idea',
      source,
      notes: notes ?? null,
      guideOverview: null,
      guideSteps: null,
      guideSkillsNeeded: null,
      guideTools: null,
      guideTimeline: null,
      guideIncomePotential: null,
      guidePitfalls: null,
      guideResources: null,
      guideGeneratedAt: null,
      guideProvider: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('earningWays', item);
    set({ items: [item, ...get().items] });
  },

  async updateStatus(id, status) {
    const updatedAt = nowIso();
    await getApi().db.update('earningWays', id, { status, updatedAt });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, status, updatedAt } : i)) });
  },

  async updateNotes(id, notes) {
    const updatedAt = nowIso();
    await getApi().db.update('earningWays', id, { notes, updatedAt });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, notes, updatedAt } : i)) });
  },

  async removeItem(id) {
    await getApi().db.remove('earningWays', id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  async fetchSuggestions() {
    set({ suggesting: true, suggestError: null });
    const result = await getApi().earningWays.suggest();
    set({
      suggesting: false,
      suggestions: result.ok ? (result.suggestions ?? []) : [],
      suggestError: result.ok ? null : (result.error ?? 'Could not get suggestions.'),
    });
  },

  async addSuggestion(suggestion) {
    await get().addItem(suggestion.title, suggestion.category as EarningWayCategory, suggestion.rationale, 'ai');
    set({ suggestions: get().suggestions.filter((s) => s !== suggestion) });
  },

  dismissSuggestion(suggestion) {
    set({ suggestions: get().suggestions.filter((s) => s !== suggestion) });
  },

  async ensureGuide(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.guideOverview) return;
    await runGuideGeneration(get, set, id);
  },

  async regenerateGuide(id) {
    await runGuideGeneration(get, set, id);
  },
}));
