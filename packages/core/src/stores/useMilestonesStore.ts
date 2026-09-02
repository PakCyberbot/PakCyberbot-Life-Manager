import { create } from 'zustand';
import { newId, nowIso, type Milestone } from '@life-manager/shared';
import { getApi } from '../api';
import { useGoalsStore } from './useGoalsStore';
import { useTasksStore } from './useTasksStore';

interface MilestonesState {
  byGoalId: Record<string, Milestone[]>;
  fetchForGoal: (goalId: string) => Promise<void>;
  addMilestone: (goalId: string, title: string, dueDate?: string | null) => Promise<void>;
  toggleMilestone: (goalId: string, id: string) => Promise<void>;
  removeMilestone: (goalId: string, id: string) => Promise<void>;
}

/** Once a goal has milestones and/or milestone-linked tasks, its progress is derived from them
 * (completed units / total units) rather than set by hand. A "unit" is either a milestone or a task
 * nested under one (see Task.linkedMilestoneId) — both get an equal-weight checkbox. Called after
 * every milestone add/toggle/remove, and by useTasksStore after any create/status-change/removal/
 * reassignment touching a milestone-linked task (see that file — this creates a two-way import
 * between useMilestonesStore and useTasksStore, safe under ESM live bindings since both sides only
 * ever call the other's `getState()`/exported function from inside an async function body, never at
 * module-eval time). A goal with zero of either unit is left alone; its progress stays whatever the
 * user set manually. */
export async function syncGoalProgressForGoal(goalId: string, milestones: Milestone[]) {
  const milestoneTasks = useTasksStore.getState().tasks.filter((t) => t.linkedGoalId === goalId && t.linkedMilestoneId);
  const totalUnits = milestones.length + milestoneTasks.length;
  if (totalUnits === 0) return;
  const completedUnits = milestones.filter((m) => m.completed).length + milestoneTasks.filter((t) => t.status === 'done').length;
  const progressPct = Math.round((completedUnits / totalUnits) * 100);
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
    await syncGoalProgressForGoal(goalId, next);
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
    await syncGoalProgressForGoal(goalId, next);
  },

  async removeMilestone(goalId, id) {
    await getApi().db.remove('milestones', id);
    const existing = get().byGoalId[goalId] ?? [];
    const next = existing.filter((m) => m.id !== id);
    set({ byGoalId: { ...get().byGoalId, [goalId]: next } });
    await syncGoalProgressForGoal(goalId, next);
  },
}));
