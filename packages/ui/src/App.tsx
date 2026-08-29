import { useState } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { AppShell } from './layout/AppShell';
import type { ScreenId } from './navigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { TasksScreen } from './screens/TasksScreen';
import { MoneyScreen } from './screens/MoneyScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');

  return (
    <ThemeProvider>
      <AppShell screen={screen} onNavigate={setScreen}>
        {screen === 'dashboard' && <DashboardScreen onNavigate={setScreen} />}
        {screen === 'goals' && <GoalsScreen />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'tasks' && <TasksScreen />}
        {screen === 'money' && <MoneyScreen />}
        {screen === 'library' && <LibraryScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </AppShell>
    </ThemeProvider>
  );
}
