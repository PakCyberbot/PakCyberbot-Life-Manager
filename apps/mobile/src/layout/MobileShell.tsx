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
        {/* max(1.5rem, safe-area-inset-top): the status bar's own height on a
            real device (confirmed live: the JS-side StatusBar.setOverlaysWebView
            call alone wasn't enough — Android's enforced edge-to-edge on newer
            API levels ignores it, so the WebView still draws under the status
            bar; CSS env() is what actually reflects the real inset), falling
            back to the plain 1.5rem spacing everywhere env() reports 0 (a
            plain browser during `npm run mobile:dev`, or an older Android
            version that isn't edge-to-edge in the first place). */}
        <div className="mx-auto max-w-lg px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">{children}</div>
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
