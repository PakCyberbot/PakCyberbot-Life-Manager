import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StatusBar } from '@capacitor/status-bar';
import { createCapacitorDataStore } from '@life-manager/db/src/capacitorDriver';
import { buildMobileApi } from './api/mobileApi';
import { App } from './App';
import './index.css';

// The WebView draws edge-to-edge by default, so unstyled content collides
// with the system status bar (confirmed live: the Dashboard's date/greeting
// rendered underneath the clock/battery icons). `overlay: false` pushes the
// WebView's content below the status bar at the native layer — more robust
// than relying on CSS env(safe-area-inset-top), which behaves inconsistently
// across OEM WebViews. No-ops harmlessly (rejects silently) in a plain
// browser during `npm run mobile:dev`, where there's no native status bar.
StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});

// Unlike Electron's preload script (window.api exists before the renderer's
// first paint), opening a native SQLite connection here is genuinely async —
// so this renders nothing (a bare-bones splash) until window.api is ready,
// then mounts the real app. Every store's first fetchX() call assumes
// window.api already exists, so this ordering matters.
async function bootstrap() {
  const root = createRoot(document.getElementById('root')!);
  root.render(<SplashScreen />);

  // createCapacitorDataStore() rejecting (a genuinely corrupted local database — see
  // capacitorDriver.ts's own notes) used to leave the splash above on screen forever: nothing
  // here ever caught it, so the app just looked stuck at startup with zero indication anything
  // had gone wrong. Confirmed happening for real on a user's own device. Never let that happen
  // silently again — any failure here has to reach the screen as something actionable.
  try {
    const store = await createCapacitorDataStore();
    window.api = buildMobileApi(store);

    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (err) {
    console.error('[bootstrap] failed to open the local database:', err);
    root.render(<StartupErrorScreen message={err instanceof Error ? err.message : String(err)} />);
  }
}

function SplashScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted">
      Loading your data…
    </div>
  );
}

function StartupErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <div className="text-base font-semibold text-red-500">Couldn't load your data</div>
      <p className="max-w-xs text-sm text-muted">{message}</p>
      <p className="max-w-xs text-xs text-muted">
        If this keeps happening, the local database file is likely damaged beyond repair. Go to Android
        Settings → Apps → PakCyberbot Life Manager → Storage → Clear storage, reopen the app, then
        reconnect Google Drive in Settings and tap Pull — if you'd synced before, your data is still
        safe there.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground active:bg-surface"
      >
        Try again
      </button>
    </div>
  );
}

void bootstrap();
