import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Workspace packages (@life-manager/*) are TypeScript source, not published
// builds — they must be bundled/transpiled by Vite rather than left as a
// bare `require()` at runtime, so they're excluded from externalization here.
// Real npm dependencies (electron, sql.js, ...) stay external and are
// resolved normally from node_modules at runtime.
const workspacePackages = [
  '@life-manager/shared',
  '@life-manager/db',
  '@life-manager/core',
  '@life-manager/ui',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/main.ts'),
        // electron-vite's dev runner always looks for out/main/index.js,
        // regardless of the entry file's own name — force that output name.
        output: { entryFileNames: 'index.js' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/preload.ts'),
        output: { entryFileNames: 'index.js' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    optimizeDeps: {
      exclude: workspacePackages,
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
