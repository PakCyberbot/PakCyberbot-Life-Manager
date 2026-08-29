import { create } from 'zustand';
import { getApi } from '../api';

export type ReaderType = 'adobe' | 'foxit' | 'custom';

const DEFAULT_CURRENCY = 'USD';

interface SettingsState {
  readerPath: string | null;
  readerType: ReaderType | null;
  currency: string;
  loaded: boolean;
  load: () => Promise<void>;
  setReader: (path: string, type: ReaderType) => Promise<void>;
  autoDetectReader: () => Promise<boolean>;
  clearReader: () => Promise<void>;
  setCurrency: (code: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  readerPath: null,
  readerType: null,
  currency: DEFAULT_CURRENCY,
  loaded: false,

  async load() {
    const [readerPath, readerType, currency] = await Promise.all([
      getApi().settings.get('readerPath'),
      getApi().settings.get('readerType'),
      getApi().settings.get('currency'),
    ]);
    set({
      readerPath: readerPath || null,
      readerType: (readerType as ReaderType) || null,
      currency: currency || DEFAULT_CURRENCY,
      loaded: true,
    });
  },

  async setReader(path, type) {
    await Promise.all([getApi().settings.set('readerPath', path), getApi().settings.set('readerType', type)]);
    set({ readerPath: path, readerType: type });
  },

  async autoDetectReader() {
    const found = await getApi().system.detectPdfReader();
    if (!found) return false;
    await get().setReader(found.path, found.type);
    return true;
  },

  async clearReader() {
    await Promise.all([getApi().settings.set('readerPath', ''), getApi().settings.set('readerType', '')]);
    set({ readerPath: null, readerType: null });
  },

  async setCurrency(code) {
    const normalized = code.trim().toUpperCase().slice(0, 3) || DEFAULT_CURRENCY;
    await getApi().settings.set('currency', normalized);
    set({ currency: normalized });
  },
}));
