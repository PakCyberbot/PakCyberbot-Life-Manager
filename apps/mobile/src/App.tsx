import { useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { getApi, useSettingsStore, useTimeTableStore } from '@life-manager/core';
import { ThemeProvider, Toast } from '@life-manager/ui';
import { MobileShell } from './layout/MobileShell';
import type { MobileScreenId } from './navigation';
import { scheduleTimeTableNotifications, TIME_TABLE_NOTIFICATIONS_SETTING_KEY } from './notifications/timeTableNotifications';
import { useShareIntentCapture } from './native/useShareIntentCapture';
import { runBackHandlers } from './native/backButtonStack';
import { MobileDashboardScreen } from './screens/MobileDashboardScreen';
import { MobileLibraryScreen } from './screens/MobileLibraryScreen';
import { MoreScreen } from './screens/MoreScreen';
import { MobileSettingsScreen } from './screens/MobileSettingsScreen';
import { GoalsView } from './screens/readonly/GoalsView';
import { CalendarView } from './screens/readonly/CalendarView';
import { SavingsView } from './screens/readonly/SavingsView';
import { EntertainmentView } from './screens/readonly/EntertainmentView';
import { EarningWaysView } from './screens/readonly/EarningWaysView';
import { JobsView } from './screens/readonly/JobsView';
import { HealthView } from './screens/readonly/HealthView';
import { NewsView } from './screens/readonly/NewsView';

// Every "section" screen reached via the More menu (readonly/*View.tsx plus Settings) already
// sends its own in-app back arrow to 'more' — SectionHeader's onBack={() => onNavigate('more')}
// is spelled out identically in each of them. This mirrors that same target for the hardware
// button, so the two ways of going back agree; only 'dashboard'/'library'/'more' themselves (the
// three bottom-tab screens) aren't reached that way, and get their own rule below.
const SECTION_SCREENS: ReadonlySet<MobileScreenId> = new Set([
  'goals',
  'calendar',
  'money',
  'entertainment',
  'earningWays',
  'jobs',
  'health',
  'news',
  'settings',
]);

export function App() {
  const [screen, setScreen] = useState<MobileScreenId>('dashboard');
  const screenRef = useRef(screen);
  const { loaded, load } = useSettingsStore();
  const { slots, fetchAll: fetchTimeTable, loaded: timeTableLoaded } = useTimeTableStore();
  const [autoSyncFailedMessage, setAutoSyncFailedMessage] = useState<string | null>(null);

  useShareIntentCapture(setScreen);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Android's hardware/gesture back button had no listener registered anywhere in this app at
  // all before this — it fell through to Capacitor's default (exit/minimize), since a single-page
  // app has no real WebView history to step back through. runBackHandlers() first gives whatever
  // full-screen overlay/detail view is currently active (the PDF reader, Goals' own goal detail —
  // see backButtonStack.ts) first claim on the press; only once nothing claims it does this fall
  // through to the same "back to More" target every section screen's own SectionHeader already
  // uses, then "More/Library back to Dashboard," then a real exit from Dashboard itself — the
  // standard Android bottom-tab back convention.
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (runBackHandlers()) return;
      const current = screenRef.current;
      if (SECTION_SCREENS.has(current)) {
        setScreen('more');
      } else if (current === 'library' || current === 'more') {
        setScreen('dashboard');
      } else {
        void CapacitorApp.exitApp();
      }
    });
    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    if (!loaded) load();
    if (!timeTableLoaded) fetchTimeTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, timeTableLoaded]);

  // Auto Sync: pull-on-startup. Unlike desktop (which runs this in main.ts before any renderer
  // exists), mobile has no separate main process — this runs right here instead, once settings
  // are loaded. A real (non-skipped) pull reloads the page itself (see mobileDriveSync.ts's
  // pull()); a skip (nothing newer, or nothing pushed yet) or a failure both leave this screen as
  // it is — failure additionally surfaces via the onAutoSyncFailed subscription below.
  useEffect(() => {
    if (!loaded) return;
    getApi()
      .settings.get('autoSyncEnabled')
      .then(async (enabled) => {
        if (enabled !== 'on') return;
        const status = await getApi().drive.status();
        if (!status.connected) return;
        await getApi().drive.pullIfNewer?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    return getApi().drive.onAutoSyncFailed(setAutoSyncFailedMessage);
  }, []);

  // Keeps notifications in sync across restarts if the user already turned
  // the setting on — re-scheduling is cheap (cancel-then-replace) and this
  // only fires once both settings and Time Table data are actually loaded.
  useEffect(() => {
    if (!loaded || !timeTableLoaded) return;
    getApi()
      .settings.get(TIME_TABLE_NOTIFICATIONS_SETTING_KEY)
      .then((value) => {
        if (value === 'on') void scheduleTimeTableNotifications(slots);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, timeTableLoaded]);

  return (
    <ThemeProvider>
      <MobileShell screen={screen} onNavigate={setScreen}>
        {screen === 'dashboard' && <MobileDashboardScreen onNavigate={setScreen} />}
        {screen === 'library' && <MobileLibraryScreen />}
        {screen === 'more' && <MoreScreen onNavigate={setScreen} />}
        {screen === 'settings' && <MobileSettingsScreen onNavigate={setScreen} />}
        {screen === 'goals' && <GoalsView onNavigate={setScreen} />}
        {screen === 'calendar' && <CalendarView onNavigate={setScreen} />}
        {screen === 'money' && <SavingsView onNavigate={setScreen} />}
        {screen === 'entertainment' && <EntertainmentView onNavigate={setScreen} />}
        {screen === 'earningWays' && <EarningWaysView onNavigate={setScreen} />}
        {screen === 'jobs' && <JobsView onNavigate={setScreen} />}
        {screen === 'health' && <HealthView onNavigate={setScreen} />}
        {screen === 'news' && <NewsView onNavigate={setScreen} />}
      </MobileShell>
      <Toast message={autoSyncFailedMessage} onDismiss={() => setAutoSyncFailedMessage(null)} />
    </ThemeProvider>
  );
}
