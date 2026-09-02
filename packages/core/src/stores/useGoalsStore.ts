import { create } from 'zustand';
import { newId, nowIso, type Goal } from '@life-manager/shared';
import { getApi } from '../api';

export interface NewGoalInput {
  title: string;
  description?: string | null;
  category?: string | null;
  type: Goal['type'];
  targetDate?: string | null;
}

interface GoalsState {
  goals: Goal[];
  loading: boolean;
  loaded: boolean;
  fetchGoals: () => Promise<void>;
  addGoal: (input: NewGoalInput) => Promise<Goal>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  loading: false,
  loaded: false,

  async fetchGoals() {
    set({ loading: true });
    const goals = await getApi().db.list<Goal>('goals');
    set({ goals, loading: false, loaded: true });
  },

  async addGoal(input) {
    const goal: Goal = {
      id: newId(),
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      type: input.type,
      targetDate: input.targetDate ?? null,
      status: 'active',
      progressPct: 0,
      imageUrl: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('goals', goal);
    set({ goals: [goal, ...get().goals] });

    // Non-blocking enrichment, same pattern as Entertainment's poster lookup — the goal shows up
    // immediately, an image patches in a moment later if Wikipedia has a real match for the title.
    // Personal/abstract goal titles often won't match anything; that's fine, not an error, and the
    // user can remove/replace it manually either way.
    getApi()
      .media.fetchWikipediaThumbnail(goal.title, '')
      .then((imageUrl) => {
        if (imageUrl) void get().updateGoal(goal.id, { imageUrl });
      })
      .catch(() => {});

    return goal;
  },

  async updateGoal(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('goals', id, { ...patch, updatedAt });
    set({ goals: get().goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt } : g)) });
  },

  async removeGoal(id) {
    await getApi().db.remove('goals', id);
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },
}));
