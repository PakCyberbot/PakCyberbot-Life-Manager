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

  const store = await createCapacitorDataStore();
  window.api = buildMobileApi(store);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

function SplashScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted">
      Loading your data…
    </div>
  );
}

void bootstrap();
