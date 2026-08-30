import { create } from 'zustand';
import { newId, nowIso, type Milestone } from '@life-manager/shared';
import { getApi } from '../api';
import { useGoalsStore } from './useGoalsStore';

interface MilestonesState {
  byGoalId: Record<string, Milestone[]>;
  fetchForGoal: (goalId: string) => Promise<void>;
  addMilestone: (goalId: string, title: string, dueDate?: string | null) => Promise<void>;
  toggleMilestone: (goalId: string, id: string) => Promise<void>;
  removeMilestone: (goalId: string, id: string) => Promise<void>;
}

/** Once a goal has milestones, its progress is derived from them (completed / total) rather than
 * set by hand — called after every add/toggle/remove so the goal's progressPct never drifts out
 * of sync. A goal with zero milestones is left alone; its progress stays whatever the user set manually. */
async function syncGoalProgress(goalId: string, milestones: Milestone[]) {
  if (milestones.length === 0) return;
  const completed = milestones.filter((m) => m.completed).length;
  const progressPct = Math.round((completed / milestones.length) * 100);
  await useGoalsStore.getState().updateGoal(goalId, { progressPct });
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
    const next = [milestone, ...existing];
    set({ byGoalId: { ...get().byGoalId, [goalId]: next } });
    await syncGoalProgress(goalId, next);
  },

  async toggleMilestone(goalId, id) {
    const existing = get().byGoalId[goalId] ?? [];
    const target = existing.find((m) => m.id === id);
    if (!target) return;
    const completed = target.completed ? 0 : 1;
    const updatedAt = nowIso();
    await getApi().db.update('milestones', id, { completed, updatedAt });
    const next = existing.map((m) => (m.id === id ? { ...m, completed, updatedAt } : m));
    set({ byGoalId: { ...get().byGoalId, [goalId]: next } });
    await syncGoalProgress(goalId, next);
  },

  async removeMilestone(goalId, id) {
    await getApi().db.remove('milestones', id);
    const existing = get().byGoalId[goalId] ?? [];
    const next = existing.filter((m) => m.id !== id);
    set({ byGoalId: { ...get().byGoalId, [goalId]: next } });
    await syncGoalProgress(goalId, next);
  },
}));
