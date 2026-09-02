import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain Vite (no electron-vite) — this is a browser/WebView target, not a
// Node main process + preload + renderer triad like apps/desktop. Capacitor
// just needs a normal static build in `dist/` (webDir in capacitor.config.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    // Capacitor's live-reload (`cap run android -l`) needs the dev server
    // reachable from the emulator/device, not just localhost.
    host: '0.0.0.0',
  },
});
