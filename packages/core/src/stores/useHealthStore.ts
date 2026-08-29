import { create } from 'zustand';
import {
  newId,
  nowIso,
  type Exercise,
  type ExerciseCategory,
  type DoctorAppointment,
  type Food,
  type BodyMetric,
} from '@life-manager/shared';
import { getApi } from '../api';

// One combined store for the whole Health section (Exercise Schedule, Doctor
// Appointments, Food & Nutrition, Body Metrics) — same precedent as
// useMoneyStore combining accounts/transactions/budgets. Food gets the same
// fire-and-forget AI-enrichment-on-add pattern as useEntertainmentStore.

interface HealthState {
  exercises: Exercise[];
  appointments: DoctorAppointment[];
  foods: Food[];
  metrics: BodyMetric[];
  loading: boolean;
  loaded: boolean;
  /** food ids currently waiting on AI nutrition info — lets the UI show a per-card "thinking" state. */
  pendingFoodIds: Set<string>;

  fetchAll: () => Promise<void>;

  addExercise: (input: {
    name: string;
    category: ExerciseCategory;
    daysOfWeek: string;
    durationMinutes?: number | null;
    sets?: number | null;
    reps?: number | null;
    notes?: string | null;
  }) => Promise<void>;
  updateExercise: (id: string, patch: Partial<Exercise>) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;

  addAppointment: (input: {
    doctorName: string;
    specialty?: string | null;
    appointmentAt: string;
    reason?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  updateAppointment: (id: string, patch: Partial<DoctorAppointment>) => Promise<void>;
  removeAppointment: (id: string) => Promise<void>;

  /** Creates the row immediately, then fills in AI nutrition info asynchronously once it lands. */
  addFood: (name: string, quantity: string, price: number | null) => Promise<void>;
  removeFood: (id: string) => Promise<void>;

  addMetric: (date: string, weight: number, unit: string, notes?: string | null) => Promise<void>;
  removeMetric: (id: string) => Promise<void>;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  exercises: [],
  appointments: [],
  foods: [],
  metrics: [],
  loading: false,
  loaded: false,
  pendingFoodIds: new Set(),

  async fetchAll() {
    set({ loading: true });
    const [exercises, appointments, foods, metrics] = await Promise.all([
      getApi().db.list<Exercise>('exercises'),
      getApi().db.list<DoctorAppointment>('doctorAppointments'),
      getApi().db.list<Food>('foods'),
      getApi().db.list<BodyMetric>('bodyMetrics'),
    ]);
    set({ exercises, appointments, foods, metrics, loading: false, loaded: true });
  },

  async addExercise(input) {
    const exercise: Exercise = {
      id: newId(),
      name: input.name,
      category: input.category,
      daysOfWeek: input.daysOfWeek,
      durationMinutes: input.durationMinutes ?? null,
      sets: input.sets ?? null,
      reps: input.reps ?? null,
      notes: input.notes ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('exercises', exercise);
    set({ exercises: [...get().exercises, exercise] });
  },

  async updateExercise(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('exercises', id, { ...patch, updatedAt });
    set({ exercises: get().exercises.map((e) => (e.id === id ? { ...e, ...patch, updatedAt } : e)) });
  },

  async removeExercise(id) {
    await getApi().db.remove('exercises', id);
    set({ exercises: get().exercises.filter((e) => e.id !== id) });
  },

  async addAppointment(input) {
    const appointment: DoctorAppointment = {
      id: newId(),
      doctorName: input.doctorName,
      specialty: input.specialty ?? null,
      appointmentAt: input.appointmentAt,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('doctorAppointments', appointment);
    set({ appointments: [...get().appointments, appointment] });
  },

  async updateAppointment(id, patch) {
    const updatedAt = nowIso();
    await getApi().db.update('doctorAppointments', id, { ...patch, updatedAt });
    set({ appointments: get().appointments.map((a) => (a.id === id ? { ...a, ...patch, updatedAt } : a)) });
  },

  async removeAppointment(id) {
    await getApi().db.remove('doctorAppointments', id);
    set({ appointments: get().appointments.filter((a) => a.id !== id) });
  },

  async addFood(name, quantity, price) {
    const food: Food = {
      id: newId(),
      name,
      quantity,
      price,
      benefits: null,
      caloriesEstimate: null,
      considerations: null,
      aiGeneratedAt: null,
      aiProvider: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('foods', food);
    set({ foods: [food, ...get().foods] });

    // Fire-and-forget: the row is already visible, nutrition fields populate when ready.
    const pending = new Set(get().pendingFoodIds);
    pending.add(food.id);
    set({ pendingFoodIds: pending });

    const result = await getApi().food.generateInfo(name, quantity);
    const stillPending = new Set(get().pendingFoodIds);
    stillPending.delete(food.id);
    set({ pendingFoodIds: stillPending });

    if (result.ok && result.info) {
      const patch: Partial<Food> = {
        benefits: result.info.benefits,
        caloriesEstimate: result.info.caloriesEstimate,
        considerations: result.info.considerations,
        aiGeneratedAt: nowIso(),
        aiProvider: result.provider ?? null,
      };
      const updatedAt = nowIso();
      await getApi().db.update('foods', food.id, { ...patch, updatedAt });
      set({ foods: get().foods.map((f) => (f.id === food.id ? { ...f, ...patch, updatedAt } : f)) });
    }
  },

  async removeFood(id) {
    await getApi().db.remove('foods', id);
    set({ foods: get().foods.filter((f) => f.id !== id) });
  },

  async addMetric(date, weight, unit, notes) {
    const metric: BodyMetric = {
      id: newId(),
      date,
      weight,
      unit,
      notes: notes ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await getApi().db.create('bodyMetrics', metric);
    set({ metrics: [metric, ...get().metrics] });
  },

  async removeMetric(id) {
    await getApi().db.remove('bodyMetrics', id);
    set({ metrics: get().metrics.filter((m) => m.id !== id) });
  },
}));
