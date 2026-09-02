import { useEffect, useState } from 'react';
import { getApi, useSettingsStore, useTimeTableStore } from '@life-manager/core';
import { ThemeProvider } from '@life-manager/ui';
import { MobileShell } from './layout/MobileShell';
import type { MobileScreenId } from './navigation';
import { scheduleTimeTableNotifications, TIME_TABLE_NOTIFICATIONS_SETTING_KEY } from './notifications/timeTableNotifications';
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

  useEffect(() => {
    if (!loaded) load();
    if (!timeTableLoaded) fetchTimeTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, timeTableLoaded]);

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
    </ThemeProvider>
  );
}
