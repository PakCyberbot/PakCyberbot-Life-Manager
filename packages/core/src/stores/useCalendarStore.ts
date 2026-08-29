import { create } from 'zustand';
import { newId, nowIso, type CalendarEvent } from '@life-manager/shared';
import { getApi } from '../api';

export interface NewEventInput {
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  color: string;
}

interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  loaded: boolean;
  fetchEvents: () => Promise<void>;
  addEvent: (input: NewEventInput) => Promise<void>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  loading: false,
  loaded: false,

  async fetchEvents() {
    set({ loading: true });
    const events = await getApi().db.list<CalendarEvent>('events');
    set({ events, loading: false, loaded: true });
  },

  async addEvent(input) {
    const event: CalendarEvent = {
      id: newId(),
      title: input.title,
      description: input.description ?? null,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      allDay: input.allDay ? 1 : 0,
      color: input.color,
      linkedGoalId: null,
      linkedTaskId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('events', event);
    set({ events: [event, ...get().events] });
  },

  async updateEvent(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('events', id, { ...patch, updatedAt });
    set({ events: get().events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt } : e)) });
  },

  async removeEvent(id) {
    await getApi().db.remove('events', id);
    set({ events: get().events.filter((e) => e.id !== id) });
  },
}));
