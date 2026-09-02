import { LayoutDashboard, Library, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import type { MobileScreenId } from '../navigation';

const TABS: { id: MobileScreenId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

// A bottom tab bar, not a sidebar — the desktop AppShell/Sidebar pair assumes
// a wide window with room for 11 always-visible top-level items; a phone
// doesn't. Three tabs cover this app's actual priorities (per the user's own
// framing): a quick-glance Dashboard, the one editable section (Library), and
// everything else tucked into a plain list under More.
export function MobileShell({
  screen,
  onNavigate,
  children,
}: {
  screen: MobileScreenId;
  onNavigate: (s: MobileScreenId) => void;
  children: React.ReactNode;
}) {
  // Treat any non-tab screen (a "More" detail view, or Settings) as belonging
  // to the More tab for highlighting purposes.
  const activeTab = screen === 'dashboard' || screen === 'library' ? screen : 'more';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 pb-6 pt-6">{children}</div>
      </main>
      <nav className="flex shrink-0 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted'
              )}
            >
              <Icon size={20} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
