# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PakCyberbot Life Manager — a local-first, cross-platform personal life management app: goals, calendar, tasks, money, a book/video library, life quotes, Google Drive sync, an AI-powered News digest, Entertainment "worth it" verdicts, Earning Ways ideas/guides, a Jobs aggregator, and an optional File Manager. Currently desktop-only (Electron); mobile/web are planned but not built. The full product vision, module roadmap, and design rationale live in [structure.md](structure.md) (technical) and [framework.md](framework.md) (the user's personal methodology/values — several AI features actually read from this file at runtime, not just aspirationally). Read those before making roadmap-level decisions; this file is about the code, not the plan.

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
- **apps/desktop** — the only shipped app target. Electron main process (`electron/main.ts`), preload (`electron/preload.ts`), Drive sync logic (`electron/driveSync.ts`), AI features (`electron/ai/`), and the Vite renderer entry (`src/main.tsx` + `index.html`).

### Why sql.js instead of better-sqlite3

`better-sqlite3` needs native compilation rebuilt against Electron's ABI (node-gyp/MSBuild), which is known to break on Windows paths containing spaces/apostrophes — this repo's own folder path has one, and it did break during development. sql.js (SQLite compiled to WebAssembly) needs zero native compilation. Trade-off: the whole DB lives in memory; `electronDriver.ts` exports it to disk (debounced ~250ms) after every write, and flushes synchronously on quit. Fine at personal-app data volumes.

### Generic CRUD over IPC, not per-entity handlers

Every table (goals, tasks, events, accounts, transactions, budgets, books, videos, quotes, newsCategories, newsItems, entertainment, earningWays, jobSearches, jobListings, fileCategories, fileLinks, daySchedules, timeSlots, links, exercises, doctorAppointments, foods, bodyMetrics) goes through the same 5 IPC channels (`db:list/get/create/update/remove`) and the same `DataStore` methods — adding a new module's table almost never needs new IPC plumbing, just: a `CREATE TABLE` in `schema.ts` (columns matching the TS type's camelCase field names exactly — no snake_case mapping layer), a shared type in `packages/shared`, a Zustand store in `packages/core`, and a screen in `packages/ui`. `newsItems`/`jobListings` are the exceptions that bypass soft-delete (see `ElectronDataStore.replaceNewsItems`/`replaceJobListings` — hard-deleted and reinserted per category/search on refresh, since they're live digests, not history worth keeping).

`settings` is the one table with its own dedicated `getSetting`/`setSetting` methods (keyed by `key`, not `id`) — used for the PDF reader path/type, Google OAuth credentials/tokens, the active AI provider + its API keys, the default currency, and per-feature AI prompt overrides (`entertainmentPrompt`). Any key in `SECRET_SETTING_KEYS` (`packages/db/src/secretCrypto.ts`) is transparently AES-256-GCM-encrypted on write and decrypted on read — currently: `googleClientId`, `googleClientSecret`, `googleRefreshToken`, `geminiApiKey`, `openaiApiKey`, `anthropicApiKey`. Add a new credential-holding setting key to that `Set` and it's covered automatically; forgetting to would store it in plaintext.

### electron-vite build gotchas (`apps/desktop/electron.vite.config.ts`)

- electron-vite's dev runner always expects `out/main/index.js` and `out/preload/index.js` — since the entry files here are named `main.ts`/`preload.ts` (not `index.ts`), `output.entryFileNames` is forced to `'index.js'` in the config for both builds.
- `externalizeDepsPlugin` only reads `apps/desktop/package.json`'s own `dependencies` to decide what to leave un-bundled (vs. transpiled inline) for the main/preload builds. A runtime dependency declared only in a workspace package (`sql.js` lives in `packages/db`'s `package.json`) won't be recognized and gets bundled incorrectly, breaking at runtime — it has to also be listed in `apps/desktop/package.json`. Workspace packages themselves (`@life-manager/*`) are explicitly excluded from externalization (see `workspacePackages` in the config) so their TS source gets bundled/transpiled rather than left as an unusable `require()` of `.ts` files.

### In-app PDF viewer + automatic bookmark (`apps/desktop/electron/main.ts`)

Books open in a dedicated `BrowserWindow` using Chromium's own built-in PDF viewer (`webPreferences.plugins: true`), not an external reader — deliberate, since neither Adobe nor Foxit expose any API to ask "what page is the user on," so automatic bookmark tracking is only possible for a viewer this app controls. The viewer updates its window URL as `#page=N` while scrolling; `did-navigate-in-page` on that window's `webContents` catches it (`parsePageFromUrl`), and on window close the last-seen page is written to the book's `bookmarkPage` and pushed to the renderer via the `book:bookmarkUpdated` IPC event (see `useBooksStore.subscribeToBookmarkUpdates`). A separate "open externally" path (configured Adobe/Foxit, or the OS default via a `file://…#page=N` URL) exists but can't auto-track — there's no way to observe another process's reading position.

### Google Drive sync (`apps/desktop/electron/driveSync.ts`)

Plain `fetch` calls against the Drive v3 REST API and Google's OAuth token endpoint — not the `googleapis` SDK, which is tens of MB for the handful of calls this needs. Uses the `drive.file` scope only (app can see only what it creates — avoids Google's sensitive-scope verification process). Auth is the installed-app OAuth loopback flow (RFC 8252): a temporary `127.0.0.1` HTTP server catches Google's redirect after consent in the system browser. Requires the user's own Google Cloud OAuth "Desktop app" Client ID/Secret, pasted into Settings — there's no way to provision that on their behalf. Push finds-or-creates a "PakCyberbot Life Manager" Drive folder and uploads/overwrites `life-manager.sqlite` in it; pull downloads and overwrites the local file, then the whole app relaunches (`app.relaunch()` + `app.exit()`, which skips the normal quit-flush) rather than trying to hot-reload the in-memory sql.js DB and every renderer store individually.

### Local backup (`db:export`/`db:import` in `main.ts`)

A Google-free alternative next to Drive sync, same relaunch-on-import reasoning. Export calls `store.flush()` — a new `ElectronDataStore` method distinct from `close()` (which also shuts the store down) — before `fs.copyFileSync`, so the exported copy reflects the true latest state rather than whatever the debounced autosave last wrote. Import validates the picked file starts with SQLite's 16-byte magic header (`"SQLite format 3\0"`, literally a null byte, not a space or other whitespace — verified against a real DB file's actual bytes during the build rather than assumed, since it's an easy thing to get subtly wrong) before overwriting anything, then follows the identical `app.relaunch()` + `app.exit()` pattern as Drive's pull.

### Multi-provider AI (`apps/desktop/electron/ai/`)

Every AI feature goes through `callAI(provider, apiKey, prompt) -> string | null` in `providers.ts`, which dispatches to Gemini/OpenAI/Anthropic's plain REST APIs (no SDKs) and always returns raw text or `null` on any failure — callers degrade gracefully, never throw. The active provider + its key live in settings (`aiProvider`, `{provider}ApiKey`). Model names are pinned constants that **will** go stale — this happened for real mid-build: a live call to `gemini-2.5-flash` came back `404`, with the API itself naming `gemini-3.6-flash` as the replacement. If a provider starts failing, check the model constant first.

Deliberately API-key-only for all three providers — there is no supported way for a third-party app to authenticate against a ChatGPT Plus or Claude Pro/Max *subscription* (separate from their APIs by design on both platforms), and faking it via web-session scraping would violate ToS. Don't build that if asked; explain why instead.

Two shared helper patterns worth knowing before touching any AI feature:
- **`framework.ts`** — `readFrameworkFile()` / `extractFrameworkSection()` read `framework.md` off disk (repo root, resolved relative to the bundled `out/main/index.js`) and pull out one `## N. Heading` section by regex. Used by both `entertainment.ts` (§6) and `earningWays.ts` (§1 + §5). Falls back to no context (not an error) if the file isn't found.
- **Never ask the AI for a URL.** Every feature that needs real links either sources them from a non-AI channel (News & Updates uses Google News RSS, matched back to AI-written summaries **by list index**, never by asking the AI to reproduce a title/URL) or asks for resource **names** only (Earning Ways guides). This was a deliberate lesson from building News & Updates — see below.

### News & Updates (`apps/desktop/electron/ai/news.ts`)

Real articles from Google News RSS (`news.google.com/rss/search?q=…`, free/keyless/no billing) + the configured AI provider ranking/summarizing them. **Not** built on Gemini's "Google Search grounding" tool, despite that being the obvious way to get an LLM to cite sources — live-tested during development and found to need a billing-enabled Google Cloud project even on an otherwise free-tier key (`429 "check your plan and billing"`, specific to that tool). `newsCategories` holds one editable custom category plus three fixed types (`global-politics`/`country`/`city`, the latter two needing a `locationValue`); `buildNewsQuery()` in `main.ts` maps a category to an RSS query + AI framing string.

### Entertainment verdicts (`apps/desktop/electron/ai/entertainment.ts`)

On `addItem`, the row is created immediately (`considering` status, verdict fields null) and the AI verdict fills in asynchronously — same non-blocking pattern as Library's cover/thumbnail fetch. One JSON call returns verdict/reasoning/skillsImproved/benefits/timeCostEstimate/addictiveness/mentalEffects together. Grounded in `framework.md` §6 **and** a Settings-editable `entertainmentPrompt` — both get folded into the same prompt when present.

### Earning Ways (`apps/desktop/electron/ai/earningWays.ts`)

Two independent AI calls: `suggestEarningWays()` (reads active Goal titles + `framework.md` §1/§5, returns up to 6 ideas the user explicitly opts into adding — never auto-inserted) and `generateEarningWayGuide()` (on-demand, first detail-dialog open, cached in the row after — `guideOverview` etc. columns — until "Regenerate").

### Jobs (`apps/desktop/electron/ai/jobs.ts`)

Same News & Updates shape, applied to job listings: real data from four free, keyless sources (RemoteOK, Arbeitnow, We Work Remotely RSS, Jobicy — deliberately not LinkedIn/Indeed/Glassdoor, whose ToS explicitly forbid scraping) queried in parallel via `Promise.allSettled`, normalized, deduped by URL, then optionally ranked/annotated by the AI provider using the same index-based reference pattern as News (never asked to reproduce a title/URL itself). `jobSearches` (label, comma-separated keywords, an AI framing prompt) are managed entirely from Settings — the Jobs screen only displays + refreshes, no criteria live outside Settings. If adding a fifth source, follow the existing `fetchX(keywords): Promise<RawJob[]>` shape and add it to the `Promise.allSettled` array in `fetchJobsForSearch` — one failing source must never sink the others.

### Sections — per-module show/hide (`packages/shared`'s `TOGGLEABLE_SECTIONS`)

Started as a File-Manager-only `fileManagerEnabled` boolean, then generalized on request into a mechanism every module uses. `TOGGLEABLE_SECTIONS`/`ToggleableSectionId` live in `packages/shared` (not `packages/ui`, even though it's primarily a navigation concern) specifically so `packages/core`'s `useSettingsStore` can reference the same list without depending on `packages/ui` — the dependency direction in this monorepo is always shared → core → ui, never the reverse. `ScreenId` in `packages/ui/src/navigation.ts` is `'dashboard' | ToggleableSectionId | 'settings'`, deriving from the shared list rather than duplicating it.

Storage: one `disabledSections` setting, comma-separated ids that are *off* (everything absent from it defaults to on) — `useSettingsStore.setSectionEnabled()` reads/writes it. `Sidebar.tsx` filters `NAV_ITEMS` by `enabledSections[item.id] !== false` (note: `!== false`, not `=== true` — `dashboard` isn't a key in the map at all and must still pass). `App.tsx` watches `enabledSections` and bounces to Dashboard if the currently-active screen becomes disabled out from under it.

**Adding a new toggleable module**: add its id to `TOGGLEABLE_SECTIONS` in `packages/shared`, an entry to `SECTION_META` in `SettingsScreen.tsx` (label + icon for the toggle list), and a `NAV_ITEMS` entry in `Sidebar.tsx` — three edits, no new settings key.

### File Manager — hostname-gated folder/file links

`fileCategories` is self-referencing via `parentId` for nesting; deleting a category cascades to every descendant category and every link inside any of them (`collectDescendantIds` in `useFileManagerStore.ts` — a plain BFS over `parentId`, unit-tested separately from Electron during the build since it's pure logic). Each `fileLinks` row records the hostname it was added from; `openLink()` in the store checks that against the current machine **before ever calling out to the main process** — a mismatch is a pure no-op in the renderer, not an IPC call that fails. Two new main-process capabilities exist only for this feature: `dialog:pickFileOrFolder` (one native dialog offering both `openFile`/`openDirectory` on Windows/Linux, with `fs.statSync` determining folder-vs-file once at add time) and `system:openLocalPath` (wraps `shell.openPath`, which transparently handles both a folder and a file).

### Time Table — weekly routine, not Calendar's dated events

`daySchedules` is a fixed set of exactly 7 rows (`dayOfWeek` 0=Sun..6=Sat), seeded once and **only ever updated** from the UI — `useTimeTableStore.updateSchedule()` looks up the existing row by `dayOfWeek` and calls `db.update`, never `db.create`/`db.remove` for this table. `timeSlots` are the actual free-form content, also keyed by `dayOfWeek` (not a date) so they repeat every week. `minutesBetween`/`formatMinutes` (`packages/shared`) handle the wake→sleep and slot-duration math, including the overnight-wrap case (sleep time numerically earlier than wake time) — this and the full seed/CRUD flow were verified with direct store calls before shipping, since none of it touches a native dialog and so, unlike File Manager/Backup, it's fully testable without a human clicking through anything.

### Health — Exercise Schedule, Doctor Appointments, Food & Nutrition, Body Metrics

One screen (`HealthScreen.tsx`, 4 internal tabs, teal `accentHealth` identity) and one combined `useHealthStore` covering all 4 tables — same combined-store precedent as `useMoneyStore` (accounts/transactions/budgets) and `useTimeTableStore` (schedules/slots). Exercises repeat weekly via a comma-separated `daysOfWeek` field (an exercise can span several days at once, e.g. `"1,3,5"` — checked with `.split(',').map(Number).includes(dayOfWeek)`, not a separate row per day like Time Table's `daySchedules`); doctorAppointments are date-specific (`appointmentAt` ISO datetime, upcoming/past computed at render time against `Date.now()`, not a stored status); bodyMetrics is a plain dated weight log with a computed delta against the previous entry. None of the four tables get seed data — health data is personal, left empty on every fresh install (unlike Quotes/News categories).

Food & Nutrition is the AI feature the section was built around: `apps/desktop/electron/ai/food.ts`'s `generateFoodInfo()` follows the exact template `entertainment.ts` established — one JSON-object prompt (`{benefits, caloriesEstimate, considerations}`), regex-extract `{...}` from the raw response, `JSON.parse` with a try/catch falling back to `null` on any failure. Wired the same way as every other AI feature: `food:generateInfo` IPC handler in `main.ts` → `FoodApi` in `packages/core/src/api.ts` → `preload.ts` → `useHealthStore.addFood()`, which creates the row immediately and fills in the AI fields asynchronously once they land (`pendingFoodIds` tracks in-flight rows for the UI's "Getting nutrition info…" state) — identical non-blocking pattern to `useEntertainmentStore.addItem()`. Not grounded in `framework.md`, unlike Entertainment/Earning Ways — nutrition facts aren't a matter of personal values the way "worth your time" or "what to pursue" are.

### Renderer security model

`contextIsolation: true`, `nodeIntegration: false` everywhere. The renderer only ever talks to `window.api` (`packages/core/src/api.ts` defines its shape; `apps/desktop/electron/preload.ts` implements it via `contextBridge`). Any new main-process capability needs three edits: an `ipcMain.handle` in `main.ts`, a matching entry in `preload.ts`'s exposed object, and a type added to the `LifeManagerApi` interface in `api.ts`.

### PDF cover rendering (`packages/ui/src/lib/pdfCover.ts`)

Runs client-side in the renderer via `pdfjs-dist`'s browser build on an offscreen `<canvas>` — deliberately not the Node `canvas` package pdf.js normally wants for server-side rendering, which is itself a native module (same category of risk as `better-sqlite3`, avoided the same way).

## Non-obvious state

- No test suite exists yet.
- No `electron-builder`/packaging config exists yet — `npm run build` produces the `out/` folder but not an installer/`.exe`.
- Git repo is initialized but has no commits yet.
- AI features live in `apps/desktop/electron/ai/`, not a `packages/ai` workspace package as structure.md originally sketched — main-process-only code (network calls, `framework.md` file access), so it never needed to be a shared package; nothing in `packages/ai` exists.
- Google Drive sync is code-complete but inert without the user's own Google Cloud OAuth credentials pasted into Settings — can't be exercised end-to-end without that.
- AI calls (especially Gemini's default "thinking" mode) can take 15–40+ seconds. Not a bug; noted here so a slow response isn't mistaken for a hang.
