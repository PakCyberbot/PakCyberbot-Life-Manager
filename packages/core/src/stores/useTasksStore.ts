import { create } from 'zustand';
import { newId, nowIso, type Task, type TaskLinkType } from '@life-manager/shared';
import { getApi } from '../api';
import { useBooksStore } from './useBooksStore';
import { useVideosStore } from './useVideosStore';

// Tasks live inside a Goal (created from its detail view) — see structure.md's
// Goals section. A task can optionally carry one link: a local file/folder
// path, or a reference to a Library book/video (jump-to-item in Library).

export interface NewTaskInput {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority: Task['priority'];
  linkedGoalId: string;
  linkType?: TaskLinkType | null;
  linkPath?: string | null;
  linkHostname?: string | null;
  linkTargetId?: string | null;
}

/** Clears a Book/Video's goal-tone `category` badge (see structure.md's Goals/Tasks section) once the
 * task that set it is gone or relinked elsewhere — but only if no *other* task still references that
 * same target, since `category` is a single shared value. `remainingTasks` should already exclude (or
 * reflect the post-change state of) the task being removed/edited. */
async function clearStaleLibraryBadge(
  oldLinkType: TaskLinkType | null | undefined,
  oldLinkTargetId: string | null | undefined,
  newLinkType: TaskLinkType | null | undefined,
  newLinkTargetId: string | null | undefined,
  remainingTasks: Task[]
) {
  if (!oldLinkTargetId) return;
  if (oldLinkType !== 'book' && oldLinkType !== 'video') return;
  if (oldLinkType === newLinkType && oldLinkTargetId === newLinkTargetId) return; // unchanged, nothing to clear

  const stillReferenced = remainingTasks.some((t) => t.linkType === oldLinkType && t.linkTargetId === oldLinkTargetId);
  if (stillReferenced) return;

  if (oldLinkType === 'book') {
    await useBooksStore.getState().updateBook(oldLinkTargetId, { category: null });
  } else {
    await useVideosStore.getState().updateVideo(oldLinkTargetId, { category: null });
  }
}

interface TasksState {
  tasks: Task[];
  loading: boolean;
  loaded: boolean;
  fetchTasks: () => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  setStatus: (id: string, status: Task['status']) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  loaded: false,

  async fetchTasks() {
    set({ loading: true });
    const tasks = await getApi().db.list<Task>('tasks');
    set({ tasks, loading: false, loaded: true });
  },

  async addTask(input) {
    const task: Task = {
      id: newId(),
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      status: 'todo',
      linkedGoalId: input.linkedGoalId,
      linkType: input.linkType ?? null,
      linkPath: input.linkPath ?? null,
      linkHostname: input.linkHostname ?? null,
      linkTargetId: input.linkTargetId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('tasks', task);
    set({ tasks: [task, ...get().tasks] });
    return task;
  },

  async updateTask(id, patch) {
    const before = get().tasks.find((t) => t.id === id);
    const updatedAt = nowIso();
    await getApi().db.update('tasks', id, { ...patch, updatedAt });
    const nextTasks = get().tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt } : t));
    set({ tasks: nextTasks });

    if (before && ('linkType' in patch || 'linkTargetId' in patch)) {
      const after = nextTasks.find((t) => t.id === id);
      await clearStaleLibraryBadge(before.linkType, before.linkTargetId, after?.linkType, after?.linkTargetId, nextTasks);
    }
  },

  async setStatus(id, status) {
    await get().updateTask(id, { status });
  },

  async removeTask(id) {
    const removed = get().tasks.find((t) => t.id === id);
    await getApi().db.remove('tasks', id);
    const remaining = get().tasks.filter((t) => t.id !== id);
    set({ tasks: remaining });

    if (removed) {
      await clearStaleLibraryBadge(removed.linkType, removed.linkTargetId, null, null, remaining);
    }
  },
}));
