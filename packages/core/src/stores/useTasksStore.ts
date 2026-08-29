import { create } from 'zustand';
import { newId, nowIso, type Task } from '@life-manager/shared';
import { getApi } from '../api';

export interface NewTaskInput {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority: Task['priority'];
}

interface TasksState {
  tasks: Task[];
  loading: boolean;
  loaded: boolean;
  fetchTasks: () => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<void>;
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
      linkedGoalId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('tasks', task);
    set({ tasks: [task, ...get().tasks] });
  },

  async updateTask(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('tasks', id, { ...patch, updatedAt });
    set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt } : t)) });
  },

  async setStatus(id, status) {
    await get().updateTask(id, { status });
  },

  async removeTask(id) {
    await getApi().db.remove('tasks', id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },
}));
