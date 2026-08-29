import { create } from 'zustand';
import { TOGGLEABLE_SECTIONS, type ToggleableSectionId } from '@life-manager/shared';
import { getApi } from '../api';

export type ReaderType = 'adobe' | 'foxit' | 'custom';

const DEFAULT_CURRENCY = 'USD';

interface SettingsState {
  readerPath: string | null;
  readerType: ReaderType | null;
  currency: string;
  /** Every section defaults to enabled; only what's explicitly turned off shows up here as false. */
  enabledSections: Record<ToggleableSectionId, boolean>;
  loaded: boolean;
  load: () => Promise<void>;
  setReader: (path: string, type: ReaderType) => Promise<void>;
  autoDetectReader: () => Promise<boolean>;
  clearReader: () => Promise<void>;
  setCurrency: (code: string) => Promise<void>;
  setSectionEnabled: (id: ToggleableSectionId, enabled: boolean) => Promise<void>;
}

function allEnabled(): Record<ToggleableSectionId, boolean> {
  return Object.fromEntries(TOGGLEABLE_SECTIONS.map((id) => [id, true])) as Record<ToggleableSectionId, boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  readerPath: null,
  readerType: null,
  currency: DEFAULT_CURRENCY,
  enabledSections: allEnabled(),
  loaded: false,

  async load() {
    const [readerPath, readerType, currency, disabledRaw] = await Promise.all([
      getApi().settings.get('readerPath'),
      getApi().settings.get('readerType'),
      getApi().settings.get('currency'),
      getApi().settings.get('disabledSections'),
    ]);
    const disabled = new Set(
      (disabledRaw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const enabledSections = Object.fromEntries(
      TOGGLEABLE_SECTIONS.map((id) => [id, !disabled.has(id)])
    ) as Record<ToggleableSectionId, boolean>;

    set({
      readerPath: readerPath || null,
      readerType: (readerType as ReaderType) || null,
      currency: currency || DEFAULT_CURRENCY,
      enabledSections,
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

  async setSectionEnabled(id, enabled) {
    const next = { ...get().enabledSections, [id]: enabled };
    const disabled = TOGGLEABLE_SECTIONS.filter((s) => !next[s]);
    await getApi().settings.set('disabledSections', disabled.join(','));
    set({ enabledSections: next });
  },
}));
