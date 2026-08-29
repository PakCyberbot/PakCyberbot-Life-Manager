import { useEffect, useState } from 'react';
import { useSettingsStore } from '@life-manager/core';
import type { ToggleableSectionId } from '@life-manager/shared';
import { ThemeProvider } from './theme/ThemeProvider';
import { AppShell } from './layout/AppShell';
import type { ScreenId } from './navigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { TimeTableScreen } from './screens/TimeTableScreen';
import { MoneyScreen } from './screens/MoneyScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { NewsScreen } from './screens/NewsScreen';
import { EntertainmentScreen } from './screens/EntertainmentScreen';
import { EarningWaysScreen } from './screens/EarningWaysScreen';
import { JobsScreen } from './screens/JobsScreen';
import { FileManagerScreen } from './screens/FileManagerScreen';
import { HealthScreen } from './screens/HealthScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');
  const enabledSections = useSettingsStore((s) => s.enabledSections);

  // If the section currently being viewed gets turned off (e.g. from
  // Settings, in another tab of this same screen), bounce back to Dashboard
  // rather than leaving the user stranded on a now-hidden screen.
  useEffect(() => {
    if (screen !== 'dashboard' && screen !== 'settings' && enabledSections[screen as ToggleableSectionId] === false) {
      setScreen('dashboard');
    }
  }, [screen, enabledSections]);

  return (
    <ThemeProvider>
      <AppShell screen={screen} onNavigate={setScreen}>
        {screen === 'dashboard' && <DashboardScreen onNavigate={setScreen} />}
        {screen === 'goals' && <GoalsScreen onNavigate={setScreen} />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'timeTable' && <TimeTableScreen />}
        {screen === 'money' && <MoneyScreen />}
        {screen === 'library' && <LibraryScreen />}
        {screen === 'news' && <NewsScreen onNavigate={setScreen} />}
        {screen === 'entertainment' && <EntertainmentScreen />}
        {screen === 'earningWays' && <EarningWaysScreen />}
        {screen === 'jobs' && <JobsScreen onNavigate={setScreen} />}
        {screen === 'fileManager' && <FileManagerScreen />}
        {screen === 'health' && <HealthScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </AppShell>
    </ThemeProvider>
  );
}
