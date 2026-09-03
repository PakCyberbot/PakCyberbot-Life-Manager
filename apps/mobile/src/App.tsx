import { useEffect, useState } from 'react';
import { getApi, useSettingsStore, useTimeTableStore } from '@life-manager/core';
import { ThemeProvider, Toast } from '@life-manager/ui';
import { MobileShell } from './layout/MobileShell';
import type { MobileScreenId } from './navigation';
import { scheduleTimeTableNotifications, TIME_TABLE_NOTIFICATIONS_SETTING_KEY } from './notifications/timeTableNotifications';
import { useShareIntentCapture } from './native/useShareIntentCapture';
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

export function App() {
  const [screen, setScreen] = useState<MobileScreenId>('dashboard');
  const { loaded, load } = useSettingsStore();
  const { slots, fetchAll: fetchTimeTable, loaded: timeTableLoaded } = useTimeTableStore();
  const [autoSyncFailedMessage, setAutoSyncFailedMessage] = useState<string | null>(null);

  useShareIntentCapture(setScreen);

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
