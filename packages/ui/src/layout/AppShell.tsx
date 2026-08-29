import { type ReactNode } from 'react';
import type { ScreenId } from '../navigation';
import { Sidebar } from './Sidebar';

export function AppShell({
  screen,
  onNavigate,
  children,
}: {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar screen={screen} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
