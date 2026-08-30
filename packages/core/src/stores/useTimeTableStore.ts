import { create } from 'zustand';
import { newId, nowIso, type DaySchedule, type TimeSlot } from '@life-manager/shared';
import { getApi } from '../api';

interface TimeTableState {
  schedules: DaySchedule[]; // always exactly 7 once loaded, one per day-of-week
  slots: TimeSlot[]; // all days at once — cheap at this scale, avoids a fetch per day switch
  loaded: boolean;

  fetchAll: () => Promise<void>;
  updateSchedule: (dayOfWeek: number, patch: { wakeTime?: string; sleepTime?: string }) => Promise<void>;
  /** Copies wakeTime/sleepTime onto every day in `days` at once — the "apply to selected days" bulk action. */
  applyScheduleToDays: (days: number[], wakeTime: string, sleepTime: string) => Promise<void>;
  addSlot: (dayOfWeek: number, startTime: string, endTime: string, label: string, notes: string | null, color: string) => Promise<void>;
  updateSlot: (id: string, patch: Partial<TimeSlot>) => Promise<void>;
  removeSlot: (id: string) => Promise<void>;
  /** Copies one slot's time/label/notes/color onto the same time on each day in `days` — "clone to other days." */
  cloneSlotToDays: (slotId: string, days: number[]) => Promise<void>;
}

export const useTimeTableStore = create<TimeTableState>((set, get) => ({
  schedules: [],
  slots: [],
  loaded: false,

  async fetchAll() {
    const [schedules, slots] = await Promise.all([
      getApi().db.list<DaySchedule>('daySchedules'),
      getApi().db.list<TimeSlot>('timeSlots'),
    ]);
    set({ schedules, slots, loaded: true });
  },

  async updateSchedule(dayOfWeek, patch) {
    const target = get().schedules.find((s) => s.dayOfWeek === dayOfWeek);
    if (!target) return;
    const updatedAt = nowIso();
    await getApi().db.update('daySchedules', target.id, { ...patch, updatedAt });
    set({
      schedules: get().schedules.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch, updatedAt } : s)),
    });
  },

  async applyScheduleToDays(days, wakeTime, sleepTime) {
    await Promise.all(days.map((d) => get().updateSchedule(d, { wakeTime, sleepTime })));
  },

  async addSlot(dayOfWeek, startTime, endTime, label, notes, color) {
    const slot: TimeSlot = {
      id: newId(),
      dayOfWeek,
      startTime,
      endTime,
      label,
      notes,
      color,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('timeSlots', slot);
    set({ slots: [...get().slots, slot] });
  },

  async updateSlot(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('timeSlots', id, { ...patch, updatedAt });
    set({ slots: get().slots.map((s) => (s.id === id ? { ...s, ...patch, updatedAt } : s)) });
  },

  async removeSlot(id) {
    await getApi().db.remove('timeSlots', id);
    set({ slots: get().slots.filter((s) => s.id !== id) });
  },

  async cloneSlotToDays(slotId, days) {
    const source = get().slots.find((s) => s.id === slotId);
    if (!source) return;
    await Promise.all(
      days.map((d) => get().addSlot(d, source.startTime, source.endTime, source.label, source.notes ?? null, source.color))
    );
  },
}));
