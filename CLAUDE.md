# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PakCyberbot Life Manager — a local-first, cross-platform personal life management app (goals, calendar, tasks, money, a book/video library, life quotes, Google Drive sync). Currently desktop-only (Electron); mobile/web are planned but not built. The full product vision, module roadmap, and design rationale live in [structure.md](structure.md) (technical) and [framework.md](framework.md) (the user's personal methodology/values — some planned AI features are meant to read from this). Read those before making roadmap-level decisions; this file is about the code, not the plan.

## Commands

Run everything from the repo root (npm workspaces — no pnpm/yarn).

- `npm install` — installs all workspace packages at once.
- `npm run dev` — starts the desktop app (electron-vite dev server + Electron), with renderer hot reload. Main-process/preload changes need the command restarted.
- `npm run typecheck` — `tsc --noEmit` across the whole workspace via `apps/desktop/tsconfig.json` (which includes all `packages/*/src`). Run this after any change — there's no separate lint step and no test suite yet.
- `npm run build` — `electron-vite build` (produces `apps/desktop/out/{main,preload,renderer}`; no installer/packaging step configured yet — that would be a separate `electron-builder` addition).

**Gotcha**: if `ELECTRON_RUN_AS_NODE=1` is set in the shell (happened during development in this environment, common when the shell is itself hosted by an Electron-based tool), `npm run dev` launches but crashes with `Cannot read properties of undefined (reading 'whenReady')` — `electron.exe` runs as a plain Node process instead of the real Electron runtime. Fix: `env -u ELECTRON_RUN_AS_NODE npm run dev` (bash), or unset it before running.

## Architecture

### Monorepo layout

npm workspaces, 4 packages + 1 app, all TypeScript, no build step for internal packages — Vite/esbuild compile each package's `.ts` source directly wherever it's imported (`package.json` "main"/"types" point straight at `src/index.ts`).

- **packages/shared** — types + tiny utils (id/date/currency helpers). Zero dependencies, so it's importable from any future target (mobile/web) unchanged.
- **packages/db** — SQLite schema (`schema.ts`) + the `DataStore` abstraction (`DataStore.ts`) + the concrete Electron implementation (`electronDriver.ts`, backed by sql.js). A future mobile/web driver would implement the same `DataStore` interface differently.
- **packages/core** — Zustand stores (one per module) that call a generic `api.db.{list,get,create,update,remove}` shape (`api.ts`) exposed on `window.api` by the Electron preload script. Stores never talk to Electron/IPC directly — that seam is what a mobile/web shell would implement differently.
- **packages/ui** — all React screens/components/theme. Platform-agnostic; `apps/desktop` just mounts `<App/>` from here.
- **apps/desktop** — the only shipped app target. Electron main process (`electron/main.ts`), preload (`electron/preload.ts`), Drive sync logic (`electron/driveSync.ts`), and the Vite renderer entry (`src/main.tsx` + `index.html`).

### Why sql.js instead of better-sqlite3

`better-sqlite3` needs native compilation rebuilt against Electron's ABI (node-gyp/MSBuild), which is known to break on Windows paths containing spaces/apostrophes — this repo's own folder path has one, and it did break during development. sql.js (SQLite compiled to WebAssembly) needs zero native compilation. Trade-off: the whole DB lives in memory; `electronDriver.ts` exports it to disk (debounced ~250ms) after every write, and flushes synchronously on quit. Fine at personal-app data volumes.

### Generic CRUD over IPC, not per-entity handlers

Every table (goals, tasks, events, accounts, transactions, budgets, books, videos, quotes, links) goes through the same 5 IPC channels (`db:list/get/create/update/remove`) and the same `DataStore` methods — adding a new module's table almost never needs new IPC plumbing, just: a `CREATE TABLE` in `schema.ts` (columns matching the TS type's camelCase field names exactly — no snake_case mapping layer), a shared type in `packages/shared`, a Zustand store in `packages/core`, and a screen in `packages/ui`.

`settings` is the one table with its own dedicated `getSetting`/`setSetting` methods (keyed by `key`, not `id`) — used for the PDF reader path/type and Google OAuth credentials/tokens.

### electron-vite build gotchas (`apps/desktop/electron.vite.config.ts`)

- electron-vite's dev runner always expects `out/main/index.js` and `out/preload/index.js` — since the entry files here are named `main.ts`/`preload.ts` (not `index.ts`), `output.entryFileNames` is forced to `'index.js'` in the config for both builds.
- `externalizeDepsPlugin` only reads `apps/desktop/package.json`'s own `dependencies` to decide what to leave un-bundled (vs. transpiled inline) for the main/preload builds. A runtime dependency declared only in a workspace package (`sql.js` lives in `packages/db`'s `package.json`) won't be recognized and gets bundled incorrectly, breaking at runtime — it has to also be listed in `apps/desktop/package.json`. Workspace packages themselves (`@life-manager/*`) are explicitly excluded from externalization (see `workspacePackages` in the config) so their TS source gets bundled/transpiled rather than left as an unusable `require()` of `.ts` files.

### In-app PDF viewer + automatic bookmark (`apps/desktop/electron/main.ts`)

Books open in a dedicated `BrowserWindow` using Chromium's own built-in PDF viewer (`webPreferences.plugins: true`), not an external reader — deliberate, since neither Adobe nor Foxit expose any API to ask "what page is the user on," so automatic bookmark tracking is only possible for a viewer this app controls. The viewer updates its window URL as `#page=N` while scrolling; `did-navigate-in-page` on that window's `webContents` catches it (`parsePageFromUrl`), and on window close the last-seen page is written to the book's `bookmarkPage` and pushed to the renderer via the `book:bookmarkUpdated` IPC event (see `useBooksStore.subscribeToBookmarkUpdates`). A separate "open externally" path (configured Adobe/Foxit, or the OS default via a `file://…#page=N` URL) exists but can't auto-track — there's no way to observe another process's reading position.

### Google Drive sync (`apps/desktop/electron/driveSync.ts`)

Plain `fetch` calls against the Drive v3 REST API and Google's OAuth token endpoint — not the `googleapis` SDK, which is tens of MB for the handful of calls this needs. Uses the `drive.file` scope only (app can see only what it creates — avoids Google's sensitive-scope verification process). Auth is the installed-app OAuth loopback flow (RFC 8252): a temporary `127.0.0.1` HTTP server catches Google's redirect after consent in the system browser. Requires the user's own Google Cloud OAuth "Desktop app" Client ID/Secret, pasted into Settings — there's no way to provision that on their behalf. Push finds-or-creates a "PakCyberbot Life Manager" Drive folder and uploads/overwrites `life-manager.sqlite` in it; pull downloads and overwrites the local file, then the whole app relaunches (`app.relaunch()` + `app.exit()`, which skips the normal quit-flush) rather than trying to hot-reload the in-memory sql.js DB and every renderer store individually.

### Renderer security model

`contextIsolation: true`, `nodeIntegration: false` everywhere. The renderer only ever talks to `window.api` (`packages/core/src/api.ts` defines its shape; `apps/desktop/electron/preload.ts` implements it via `contextBridge`). Any new main-process capability needs three edits: an `ipcMain.handle` in `main.ts`, a matching entry in `preload.ts`'s exposed object, and a type added to the `LifeManagerApi` interface in `api.ts`.

### PDF cover rendering (`packages/ui/src/lib/pdfCover.ts`)

Runs client-side in the renderer via `pdfjs-dist`'s browser build on an offscreen `<canvas>` — deliberately not the Node `canvas` package pdf.js normally wants for server-side rendering, which is itself a native module (same category of risk as `better-sqlite3`, avoided the same way).

## Non-obvious state

- No test suite exists yet.
- No `electron-builder`/packaging config exists yet — `npm run build` produces the `out/` folder but not an installer/`.exe`.
- Git repo is initialized but has no commits yet.
- The AI features described in structure.md (Gemini integration, `packages/ai`) are documented/planned but not built.
