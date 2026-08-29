import { create } from 'zustand';
import { newId, nowIso, type Milestone } from '@life-manager/shared';
import { getApi } from '../api';

interface MilestonesState {
  byGoalId: Record<string, Milestone[]>;
  fetchForGoal: (goalId: string) => Promise<void>;
  addMilestone: (goalId: string, title: string, dueDate?: string | null) => Promise<void>;
  toggleMilestone: (goalId: string, id: string) => Promise<void>;
  removeMilestone: (goalId: string, id: string) => Promise<void>;
}

export const useMilestonesStore = create<MilestonesState>((set, get) => ({
  byGoalId: {},

  async fetchForGoal(goalId) {
    const milestones = await getApi().db.list<Milestone>('milestones', { goalId });
    set({ byGoalId: { ...get().byGoalId, [goalId]: milestones } });
  },

  async addMilestone(goalId, title, dueDate) {
    const milestone: Milestone = {
      id: newId(),
      goalId,
      title,
      dueDate: dueDate ?? null,
      completed: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('milestones', milestone);
    const existing = get().byGoalId[goalId] ?? [];
    set({ byGoalId: { ...get().byGoalId, [goalId]: [milestone, ...existing] } });
  },

  async toggleMilestone(goalId, id) {
    const existing = get().byGoalId[goalId] ?? [];
    const target = existing.find((m) => m.id === id);
    if (!target) return;
    const completed = target.completed ? 0 : 1;
    const updatedAt = nowIso();
    await getApi().db.update('milestones', id, { completed, updatedAt });
    set({
      byGoalId: {
        ...get().byGoalId,
        [goalId]: existing.map((m) => (m.id === id ? { ...m, completed, updatedAt } : m)),
      },
    });
  },

  async removeMilestone(goalId, id) {
    await getApi().db.remove('milestones', id);
    const existing = get().byGoalId[goalId] ?? [];
    set({ byGoalId: { ...get().byGoalId, [goalId]: existing.filter((m) => m.id !== id) } });
  },
}));
