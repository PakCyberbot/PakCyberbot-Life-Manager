import { create } from 'zustand';
import { getApi } from '../api';

export type ReaderType = 'adobe' | 'foxit' | 'custom';

interface SettingsState {
  readerPath: string | null;
  readerType: ReaderType | null;
  loaded: boolean;
  load: () => Promise<void>;
  setReader: (path: string, type: ReaderType) => Promise<void>;
  autoDetectReader: () => Promise<boolean>;
  clearReader: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  readerPath: null,
  readerType: null,
  loaded: false,

  async load() {
    const [readerPath, readerType] = await Promise.all([
      getApi().settings.get('readerPath'),
      getApi().settings.get('readerType'),
    ]);
    set({
      readerPath: readerPath || null,
      readerType: (readerType as ReaderType) || null,
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
}));
