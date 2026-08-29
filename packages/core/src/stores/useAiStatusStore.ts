import { create } from 'zustand';
import { getApi, type AiStatus } from '../api';

// Shared between the Sidebar (shows a warning banner when the active
// provider is rate-limited/out of quota) and Settings (the full status +
// "Check now" button) — a single subscription to 'ai:statusChanged' feeds
// both, rather than each screen polling or subscribing separately.

interface AiStatusState {
  status: AiStatus | null;
  loaded: boolean;
  checking: boolean;
  subscribed: boolean;
  load: () => Promise<void>;
  checkNow: () => Promise<void>;
  subscribe: () => void;
}

export const useAiStatusStore = create<AiStatusState>((set, get) => ({
  status: null,
  loaded: false,
  checking: false,
  subscribed: false,

  async load() {
    const status = await getApi().ai.getStatus();
    set({ status, loaded: true });
  },

  async checkNow() {
    set({ checking: true });
    const status = await getApi().ai.checkStatus();
    set({ status, checking: false });
  },

  subscribe() {
    if (get().subscribed) return;
    set({ subscribed: true });
    getApi().ai.onStatusChanged((status) => set({ status, loaded: true }));
  },
}));
