import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createCapacitorDataStore } from '@life-manager/db/src/capacitorDriver';
import { buildMobileApi } from './api/mobileApi';
import { App } from './App';
import './index.css';

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
