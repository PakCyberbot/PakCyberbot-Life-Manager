import { create } from 'zustand';
import { TOGGLEABLE_SECTIONS, type ToggleableSectionId } from '@life-manager/shared';
import { getApi } from '../api';

export type ReaderType = 'adobe' | 'foxit' | 'custom';
/** Which Time Table clock face to render wherever a clock view is shown — Classic (ClockView.tsx,
 * two static AM/PM rings) or the newer LiveRotatingClock.tsx (one live face, continuously-flipping
 * AM/PM labels). A DB-backed setting (not localStorage) so the choice is the same on every device,
 * desktop or mobile, once Drive sync carries it over — unlike theme, which really is per-device. */
export type ClockStyle = 'classic' | 'liveRotating';
/** List or Clock for the Dashboard's "Today's Time Table" card specifically — independent of the
 * full Time Table screen's own List/Clock toggle, which stays a plain per-session choice (not asked
 * to persist). Also DB-backed, for the same cross-device reason as clockStyle. */
export type DashboardTimeTableView = 'list' | 'clock';

const DEFAULT_CURRENCY = 'USD';

interface SettingsState {
  readerPath: string | null;
  readerType: ReaderType | null;
  currency: string;
  clockStyle: ClockStyle;
  dashboardTimeTableView: DashboardTimeTableView;
  /** Every section defaults to enabled; only what's explicitly turned off shows up here as false. */
  enabledSections: Record<ToggleableSectionId, boolean>;
  loaded: boolean;
  load: () => Promise<void>;
  setReader: (path: string, type: ReaderType) => Promise<void>;
  autoDetectReader: () => Promise<boolean>;
  clearReader: () => Promise<void>;
  setCurrency: (code: string) => Promise<void>;
  setClockStyle: (style: ClockStyle) => Promise<void>;
  setDashboardTimeTableView: (view: DashboardTimeTableView) => Promise<void>;
  setSectionEnabled: (id: ToggleableSectionId, enabled: boolean) => Promise<void>;
}

function allEnabled(): Record<ToggleableSectionId, boolean> {
  return Object.fromEntries(TOGGLEABLE_SECTIONS.map((id) => [id, true])) as Record<ToggleableSectionId, boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  readerPath: null,
  readerType: null,
  currency: DEFAULT_CURRENCY,
  clockStyle: 'classic',
  dashboardTimeTableView: 'list',
  enabledSections: allEnabled(),
  loaded: false,

  async load() {
    const [readerPath, readerType, currency, disabledRaw, clockStyleRaw, dashboardTimeTableViewRaw] = await Promise.all([
      getApi().settings.get('readerPath'),
      getApi().settings.get('readerType'),
      getApi().settings.get('currency'),
      getApi().settings.get('disabledSections'),
      getApi().settings.get('timeTableClockStyle'),
      getApi().settings.get('dashboardTimeTableView'),
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
      clockStyle: clockStyleRaw === 'liveRotating' ? 'liveRotating' : 'classic',
      dashboardTimeTableView: dashboardTimeTableViewRaw === 'clock' ? 'clock' : 'list',
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

  async setClockStyle(style) {
    await getApi().settings.set('timeTableClockStyle', style);
    set({ clockStyle: style });
  },

  async setDashboardTimeTableView(view) {
    await getApi().settings.set('dashboardTimeTableView', view);
    set({ dashboardTimeTableView: view });
  },

  async setSectionEnabled(id, enabled) {
    const next = { ...get().enabledSections, [id]: enabled };
    const disabled = TOGGLEABLE_SECTIONS.filter((s) => !next[s]);
    await getApi().settings.set('disabledSections', disabled.join(','));
    set({ enabledSections: next });
  },
}));
