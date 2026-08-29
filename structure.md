# LIFE Manager — Planning Doc

Status: **v1 desktop in progress** — Dashboard, Goals, Calendar, Tasks, and Money are scaffolded and running (see §11). This file is still the living architecture doc; edit freely as things evolve.

## 1. Vision

A single cross-platform app that replaces the scattered notes-apps/spreadsheets/reminders you currently use to run your life: goals, calendar, money, assets, learning, and the reminders/quotes that keep you on track. Local-first so it works offline and feels instant, with sync added once the core is solid.

## 2. Decisions locked so far

| Decision | Choice | Why |
|---|---|---|
| Cross-platform approach | **Electron (desktop) + Capacitor (mobile)** | Pure JS/Node stack, one web codebase reused across both shells, biggest ecosystem/community support |
| Data storage | **Local-first (SQLite)**, sync added later | App fully usable offline from day one; multi-device sync bolted on once core modules are proven |
| V1 scope | **Core 4 modules**: Goals/Targets, Calendar, Tasks, Money Management | Build these deeply first; the rest arrive in v2+ once the foundation (data layer, cross-module linking, dashboard) is proven |
| Sync backend | **Google Drive**, a normal named "PakCyberbot Life Manager" folder (not the hidden App Data folder originally planned) | $0 cost, no server to host, uses the user's own Drive quota; a visible folder was chosen over hidden App Data so the user can see/manage the backup file themselves |
| AI provider | **Gemini, OpenAI, or Anthropic — user's choice, each via its own API key** (§11) | $0 baseline (works with just one free key); "log in with a ChatGPT/Claude subscription" isn't a real integration path for a third-party app and was explicitly ruled out. AI stays an optional enhancement everywhere, never a dependency — every AI feature degrades gracefully with no key configured |

## 3. Open decisions (to discuss)

- **App name** — keep "LIFE Manager" or pick a proper product name? (Currently the app identifies itself as "LIFE Manager" — see §11.)
- **Google API project setup** — both Drive sync and Gemini need a (free) Google Cloud project with OAuth consent screen + API keys. We'll need your Google account (pakcyberbot@gmail.com or another) to register it when we get to that step — no billing account required for either free tier.

Resolved during the v1 build (§11 has the full rationale):
- **UI framework**: React + TypeScript + Vite + TailwindCSS + Zustand, as proposed — but with hand-built component primitives instead of shadcn/ui (no CLI dependency risk), and no router (a single-window desktop app just switches an in-memory "screen" id).
- **Monorepo tool**: plain **npm workspaces**, not pnpm/Turborepo — simpler, ships with Node, and at 5 packages the build-caching pnpm/Turborepo would buy isn't needed yet.
- **Database driver**: **sql.js** (SQLite-as-WebAssembly) instead of `better-sqlite3` — see §11 for why.

## 4. Guiding principles

1. **Local-first** — every feature must work fully offline; sync is an enhancement, never a requirement.
2. **One codebase, many shells** — UI and business logic live in shared packages; `apps/desktop` and `apps/mobile` (and later `apps/web`) are thin wrappers.
3. **Modular** — each life-area (Goals, Calendar, Money, …) is a self-contained module with its own data model, but modules can **link** to each other (a Goal can reference a Skill, a Transaction can reference a Budget, etc.) via a shared tagging/linking layer rather than hard foreign keys everywhere.
4. **Boring, provable tech** — SQLite, React, TypeScript. No exotic dependencies for a solo-maintained personal app.
5. **Ship the core, then widen** — v1 proves the architecture with 4 modules; v2+ adds breadth.
6. **The app follows your framework, not the other way round** — your personal methodology (values, priorities, what "worth it" means to you) lives in a separate, evolving [`framework.md`](framework.md), not hardcoded in the app. AI features (like the Entertainment verdicts below) read from it so judgments are grounded in your own stated rules, not a generic model opinion.

## 5. Module roadmap

### v1 — Core (this phase)
- **Goals & Targets** — short/long-term goals, milestones, progress tracking, optional OKR-style structure
- **Calendar** — events, recurring items (RRULE), reminders
- **Tasks** — unifying to-do layer that Goals, Calendar, and (later) Habits all feed into
- **Money Management** — accounts, transactions, budgets

### v2 — Expansion
- **Asset Management** — devices/hardware inventory, purchase date, warranty expiry, current value
- **Shopping / Wishlist** — what to buy, priority, price tracking, links
- **Library (Books & Videos)** — pulled forward and built in v1 as the "Learning & Reading" module made concrete, see §11 for the actual implementation (custom PDF paths + bookmark/reader launch for books, YouTube thumbnail fetch for videos)
- **Skills & Earning** — skills to learn/improve, target income per skill, portfolio links
- **Earning Ways** — track income streams (freelancing, jobs, side hustles, businesses, investments, passive income) you're doing or considering. Add your own, or ask Gemini to recommend more based on your Skills, Goals, and `framework.md` context. Opening an earning way's detail view triggers Gemini to generate a full **A–Z guide** on demand (overview → how to get started → skills/tools needed → realistic timeline → income potential → common pitfalls → resources), cached after first generation with a manual "regenerate" option. Links to Skills (what it needs) and Money (actual income earned from it, once transactions can be tagged)
- **Habit Tracker** — daily/weekly habits, streaks, linkable to Goals
- ~~**Life Quotes / Reminders**~~ — built in v1, see §11
- ~~**Entertainment / Leisure**~~ — built in v1 (§11), minus the Calendar auto-scheduling and lookup-by-title metadata (genre/runtime/ratings), which are still future work

### v3 — Depth / nice-to-haves
- **Journal / Daily Review** — short end-of-day reflection, optionally prompted by a quote
- **Contacts (CRM-lite)** — birthdays, "haven't talked to X in a while" nudges
- **Documents Vault** — metadata tracking for important docs (expiry dates, renewal reminders) — *not* a password manager
- **Net Worth over time** — auto-computed chart from Money + Assets
- **Subscriptions Tracker** — recurring payments, renewal alerts (could fold into Money earlier if it's cheap to add)
- **Multi-device sync** — Google Drive App Data folder, push/pull with last-write-wins merge
- **AI Assistant** — Gemini-powered: natural-language quick-add ("remind me to pay rent every 1st" → structured Task/Event), auto-categorize transactions, suggest quotes/insights, summarize your week, recommend new Earning Ways, and surface **Framework Suggestions** — new practices/methodologies it thinks fit your data, appended to a dedicated auto-suggestions subsection of `framework.md` (never edits your own writing, only adds to its own section) for you to review and decide whether to adopt. Always optional/best-effort — every feature must still work if Gemini is unreachable or the free-tier quota is hit
- **Cloud/web deployment** — `apps/web` reusing the same `packages/ui` + `packages/core`

## 6. Tech stack (proposed)

- **Language**: TypeScript everywhere
- **UI**: React + Vite + TailwindCSS, Zustand for state, hand-built component primitives (Button/Card/Dialog/etc. in `packages/ui/src/components/ui`) instead of a UI-kit CLI
- **Desktop shell**: Electron via `electron-vite` (dev server + build), `electron-builder` for packaging/auto-update later
- **Mobile shell**: Capacitor (iOS + Android), same built web bundle
- **Web shell** (v3): same Vite build deployed as a static site / installable PWA
- **Database**: SQLite, accessed behind a shared `DataStore` repository interface (`packages/db/src/DataStore.ts`) so each shell can plug in its own driver:
  - Desktop: **sql.js** (SQLite compiled to WebAssembly) in the Electron main process, exposed to the renderer over IPC. Chosen over `better-sqlite3` because that's a native module requiring a node-gyp/MSBuild rebuild against Electron's ABI — a toolchain known to break on Windows paths containing spaces/apostrophes, which this project's folder has. sql.js needs no native compilation and happens to also run in browsers, which lines up with the future web target. Trade-off: the DB lives in memory and is explicitly exported to disk (debounced) after writes — fine at this data scale.
  - Mobile: `@capacitor-community/sqlite`
  - Web (later): `sql.js` again, or defer straight to the sync backend
- **Notifications**: Electron `Notification` API on desktop, Capacitor Local Notifications plugin on mobile — both driven by one shared reminder-scheduling module in `packages/core`
- **Sync**: Google Drive API v3 (`googleapis` package) against the app-specific "App Data" folder, OAuth2 sign-in (`google-auth-library`), free — no server to host, uses the user's own 15GB free Drive quota
- **AI**: Gemini API free tier (`@google/genai` SDK), called directly from the client for quick-add parsing, categorization suggestions, and insights — no backend proxy needed since this is a personal single-user app
- **Monorepo**: pnpm workspaces (+ Turborepo for build caching) — TBD per open decision above
- **Testing**: Vitest

## 7. Proposed folder structure

```
life-manager/
├── structure.md                  # this file
├── package.json                  # workspace root
├── pnpm-workspace.yaml
├── apps/
│   ├── desktop/                  # Electron shell
│   │   ├── src/main/             # main process: window mgmt, SQLite (better-sqlite3), IPC handlers
│   │   ├── src/preload/          # contextBridge APIs exposed to renderer
│   │   └── electron-builder.yml
│   ├── mobile/                   # Capacitor shell (iOS + Android)
│   │   ├── ios/
│   │   ├── android/
│   │   └── capacitor.config.ts
│   └── web/                      # (v3) plain web/PWA deploy of the same UI
│
├── packages/
│   ├── ui/                       # shared React screens + components (used by all shells)
│   │   ├── screens/
│   │   │   ├── dashboard/
│   │   │   ├── goals/
│   │   │   ├── calendar/
│   │   │   ├── tasks/
│   │   │   └── money/
│   │   └── components/           # buttons, forms, charts, shared primitives
│   │
│   ├── core/                     # business logic, platform-agnostic
│   │   ├── models/                # Goal, Milestone, Event, Task, Account, Transaction, Budget, ...
│   │   ├── stores/                # Zustand stores per module
│   │   ├── reminders/             # shared scheduling logic (platform sends the actual notification)
│   │   └── linking/               # cross-module tag/link system
│   │
│   ├── db/                       # data access layer
│   │   ├── schema/                # SQLite schema + migrations (shared SQL, versioned)
│   │   ├── DataStore.ts           # abstract repository interface
│   │   ├── drivers/
│   │   │   ├── electron.ts        # better-sqlite3 implementation
│   │   │   └── capacitor.ts       # @capacitor-community/sqlite implementation
│   │   └── sync/                  # (v3) push/pull against Google Drive App Data folder
│   │
│   ├── ai/                       # (v3) Gemini integration — quick-add parsing, categorization, insights
│   │   ├── client.ts              # Gemini SDK wrapper, free-tier rate-limit handling
│   │   ├── framework-context.ts   # loads framework.md (or its DB copy) as grounding context for prompts
│   │   └── prompts/               # per-feature prompt templates
│   │       ├── quick-add.ts
│   │       ├── transaction-categorize.ts
│   │       ├── entertainment-worth-it.ts   # looks up title, verdicts against framework.md + active Goals/Skills
│   │       ├── earning-way-recommend.ts    # suggests new income streams from Skills/Goals/framework.md
│   │       ├── earning-way-guide.ts        # generates the A-Z guide on popup open
│   │       └── framework-suggest.ts        # proposes new practices, appended to framework.md's AI section
│   │
│   └── shared/                   # types, constants, date/currency utils
│
└── docs/
    └── decisions/                 # short ADR-style notes as we make bigger calls
```

## 8. Data model sketch (v1 modules only)

```
Goal
  id, title, description, category, type (short-term|long-term|okr)
  targetDate, status, progressPct
  linkedTags: Link[]              # e.g. link to a future Skill or Learning item

Milestone
  id, goalId, title, dueDate, completed

Task                               # the unifying to-do layer
  id, title, notes, dueDate, priority, status
  recurrenceRule?                 # RRULE string
  linkedGoalId?, linkedEventId?
  tags: string[]

Event                              # Calendar
  id, title, description
  startAt, endAt, allDay
  recurrenceRule?                 # RRULE string
  reminders: Reminder[]
  linkedGoalId?, linkedTaskId?
  color/category

Account                            # Money
  id, name, type (cash|bank|credit|investment), currency, startingBalance

Transaction
  id, accountId, amount, type (income|expense|transfer)
  category, date, note, tags: string[]

Budget
  id, category, monthlyLimit, period
```

### Entertainment / Leisure (built in v1 — see §11 for the real schema/flow)

Superseded by what actually shipped; kept here for the parts still unbuilt (Calendar auto-scheduling from a time budget, Gemini lookup of title metadata/ratings). `entertainmentWeeksOfMonth` setting remains future work alongside that.

### Earning Ways (v2/v3, illustrative — not built in v1)

```
EarningWay
  id, title, category (freelance|job|business|investment|passive|other)
  status (idea|exploring|active|paused|stopped)
  source (userAdded|geminiRecommended)
  linkedSkillIds[]                       # what skills it needs/grows
  guide?: {                              # generated on first popup open, cached after
    overview, gettingStartedSteps[], skillsNeeded[], toolsPlatforms[],
    timelineExpectation, incomePotential, commonPitfalls[], resources[],
    generatedAt, modelUsed
  }
  notes
  # actual earnings tracked via the generic `links` table against Money's Transaction rows,
  # not a duplicate field here — avoids the numbers drifting out of sync
```

### Cross-cutting systems (built once, used everywhere)
- **Linking/Tags** — a generic `links` table (`entityType`, `entityId`, `linkedType`, `linkedId`) so any module can reference any other without schema changes each time we add a module.
- **Reminder engine** — one scheduler in `packages/core/reminders`; Calendar and Tasks use it in v1, Habits/Quotes/Documents plug into the same engine in v2/v3.
- **Dashboard** — pulls "today's" top items from each active module; grows automatically as new modules register themselves.
- **Settings** — theme, currency, week-start-day, notification preferences.
- Every row on every table carries `id`, `updatedAt`, and `deletedAt` (soft delete) from v1 onward — costs nothing now, and is exactly what the Drive sync merge logic in §9 needs later, so we don't have to migrate the schema retroactively.

## 9. How Google Drive sync works (built — see §11 for the actual implementation)

This section was written before the build; §11's "Google Drive sync" subsection describes what's actually shipped, which differs in a few ways below. Left here for the original reasoning, since most of it still holds:

1. ~~Sign in with Google (OAuth2, requested scope limited to `drive.appdata`~~ — built as `drive.file` instead, and against a normal visible "PakCyberbot Life Manager" folder rather than the hidden App Data folder, so the user can see/manage the backup themselves. Still narrow-scoped: the app can only see what it creates, nothing else in the user's Drive.
2. ~~export changed rows... to a JSON snapshot~~ — built simpler: push/pull the whole SQLite file wholesale, not a row-level diff/merge. Sufficient for a single person realistically syncing from one device at a time (point 5 below), and avoids building a merge engine before it's needed.
3. Pull replaces the local DB outright (after an explicit confirm — it's destructive to unsynced local changes) rather than merging.
4. Manual Push/Pull buttons, not automatic on a timer — deliberate, so a sync never happens without the user knowing.
5. Conflict handling stays simple (whole-file overwrite) since one person is realistically editing from one device at a time — revisit with real row-level merging if that assumption breaks in practice.

## 10. Next steps

1. ~~Confirm/adjust the open decisions in §3~~ — done, see §11
2. ~~Scaffold the monorepo skeleton per §7~~ — done
3. ~~Stand up `packages/db` with the SQLite schema for the 4 v1 modules + the `links` table~~ — done
4. ~~Build `packages/core` models/stores for Goals → Tasks → Calendar → Money~~ — done
5. ~~Build `apps/desktop` shell, wire it to `packages/ui` + `packages/core` + `packages/db`~~ — done, running (§11)
6. Use the app for real for a bit, note friction points, then decide what v1.1 fixes vs what's a v2 module (Entertainment, Earning Ways, Habits, ...)
7. Once desktop v1 is usable daily, add `apps/mobile` via Capacitor reusing the same UI/core

## 11. V1 desktop — build status & how to run

The desktop app is scaffolded and running, branded as **PakCyberbot Life Manager** (window icon + sidebar mark from `logo.ico`/`logo.png` at the repo root). What exists right now:

- **Screens**: Dashboard (today view across all modules + a random Quotes card), Goals (cards + progress + milestones in a detail dialog), Tasks (3-column to-do/in-progress/done board), Calendar (month grid, click a day to view/add events), Money (accounts, transactions, budgets vs. spend, per-account currency + a Settings-wide default), **Library** (Books & Videos), **News & Updates**, **Entertainment** (see below for both), Settings (theme, default currency, PDF reader config, quotes management, Google Drive sync, AI provider + keys, News categories)
- **Theme**: light/dark/system, toggled from the sidebar or Settings, persisted per-device in `localStorage`; primary accent shifted to a green matching the new logo, plus a sixth module accent (rose) for Library
- **Window**: opens maximized by default ("full screen" in the everyday sense — fills the screen but keeps the title bar/taskbar, unlike OS kiosk fullscreen which hides all window chrome)
- **Data**: everything persists locally to `%APPDATA%/PakCyberbot Life Manager/life-manager.sqlite` via sql.js — closing and reopening the app keeps your data
- Cross-module linking (`links` table) and Budgets exist in the schema/UI at a basic level; recurrence, notifications, and the v2/v3 modules from §5 (other than Library) are not built yet

### Life Quotes

A `quotes` table (`text`, `author?`), seeded with 5 defaults on first launch only (2 from you, 3 written for the app — none attributed to a real person, to avoid ever misattributing a quote someone didn't actually say). Managed entirely from Settings (add/delete); the Dashboard shows one at random each time it's opened, with a shuffle button to see another without leaving the page.

### Google Drive sync — implemented, needs your Google credentials to activate

Settings now has a real **Push to Drive** / **Pull from Drive** pair, not a placeholder. How it works:

- **Scope**: `drive.file` — the app can only ever see files/folders *it* creates, never the rest of your Drive. This matters practically: broader scopes require Google to review/verify the app before it'll work for anyone but you in "testing" mode; `drive.file` avoids that entirely, which is exactly what a personal single-user app wants.
- **Push**: finds-or-creates a folder literally named "PakCyberbot Life Manager" in your Drive root, then creates or overwrites `life-manager.sqlite` inside it.
- **Pull**: downloads that file and overwrites the local DB — after confirming with you first, since it discards anything added locally since the last push. On success, the app relaunches itself (`app.relaunch()` + `app.exit()`, which skips the normal shutdown flush, so the just-pulled file can't get overwritten by stale in-memory data) so every cache — the DB and all the Zustand stores — reloads clean from the pulled file, rather than trying to hot-patch a dozen different in-memory caches individually.
- **Auth**: the standard installed-app OAuth loopback flow (RFC 8252) — a temporary `127.0.0.1` server catches Google's redirect after you approve access in your normal browser, no embedded webview. Refresh token stored in the local `settings` table.
- **Implementation**: plain `fetch` calls against the Drive v3 REST API and Google's OAuth token endpoint (`apps/desktop/electron/driveSync.ts`) — deliberately not the `googleapis` SDK, which is tens of MB for the handful of calls this needs.
- **What you still need to do**: paste a Google OAuth "Desktop app" Client ID + Secret into Settings once — see the setup steps in chat. Nothing here can be tested end-to-end without that; it's a genuine external dependency, not a code gap.

### AI providers — API key only, by design

Settings has an "AI provider" section supporting **Gemini, OpenAI, and Anthropic (Claude)**, each via its own API key (`apps/desktop/electron/ai/providers.ts`), switchable instantly. This is deliberately **not** "log in with your ChatGPT Plus / Claude Pro subscription" — that isn't a real integration path for a third-party app: OpenAI bills API usage completely separately from ChatGPT Plus by design, and Claude's subscription access is scoped to Anthropic's own apps (Claude.ai, Claude Code — which built this feature). The only way to fake subscription-login access would be scraping the web app's session, which violates both platforms' Terms of Service and risks the account — not implemented, and won't be.

Model names are pinned as constants and **will** go stale — this was discovered firsthand mid-build when a live test against `gemini-2.5-flash` came back `404` with the API itself recommending `gemini-3.6-flash` as the replacement. If a provider starts failing, check the model constant first.

### Encrypted settings

Any settings key that holds a credential (`googleClientId`, `googleClientSecret`, `googleRefreshToken`, `geminiApiKey`, `openaiApiKey`, `anthropicApiKey`) is transparently encrypted at rest with AES-256-GCM (`packages/db/src/secretCrypto.ts`), keyed off a hardcoded app passphrase — `getSetting`/`setSetting` encrypt/decrypt automatically, so callers never see ciphertext. Honest caveat documented in the code: a hardcoded key can't stop someone with the app's own source from deriving it — there's no server-side secret to lean on in a purely local app. What it does protect against, and the actual point of it, is the far more likely case: the raw `.sqlite` file (or a cloud backup of it, or another process scanning disk) exposing API keys just by being opened in a viewer. Verified during the build by grepping the raw DB file for a real seeded key — absent in plaintext, present as `enc:iv:tag:ciphertext`.

### News & Updates

Real articles with guaranteed-real links, not an AI's guess at a URL. The design came out of a live finding: Gemini's "Google Search grounding" tool (the obvious way to get an LLM to cite real sources) turned out to require a billing-enabled Google Cloud project even on an otherwise free-tier key — confirmed by hitting a `429 "check your plan and billing"` specific to that tool while plain calls worked fine. So instead (`apps/desktop/electron/ai/news.ts`):

1. Real articles come from **Google News RSS** (`news.google.com/rss/search?q=…`) — free, keyless, no billing, confirmed live to return same-day dated results with working links.
2. The configured AI provider ranks/prioritizes them and writes a one-line "why it matters" per item — referenced back to the original RSS item **by list index**, not by asking the AI to reproduce a title or URL, so a real link is guaranteed even if the AI paraphrases.
3. If no AI provider is configured, or the AI call fails for any reason, it falls back to showing the raw RSS results unranked/unsummarized rather than showing nothing.

**Categories** (`newsCategories` table): one editable **custom** category (name + prompt — seeded as "Cybersecurity" per the user's own example), plus three fixed built-ins — **Global Politics** (fixed prompt), **Country** and **City** (need a location set in Settings before they'll fetch). More custom categories can be added freely. Each category's latest fetch replaces the previous one wholesale (`newsItems`, hard-deleted and reinserted via `ElectronDataStore.replaceNewsItems` — a live digest, not a growing archive) rather than going through the generic soft-delete `remove()`, so refreshing repeatedly doesn't bloat the DB. Refresh is manual (a button per category), not automatic, to stay mindful of free-tier AI quotas.

### Entertainment — "worth your time" verdicts

The first real use of `framework.md` as AI context, exactly as originally designed in §4's guiding principles. Add a title + type (movie/show/anime/game/book/other); the row appears immediately (`considering` status) and a verdict fills in asynchronously a moment later, same non-blocking pattern as Library's cover/thumbnail fetch. The verdict (`apps/desktop/electron/ai/entertainment.ts`) covers exactly what was asked for: a **Worth It / Mixed / Skip** call, reasoning, skills it could build, genuine benefits, a realistic time-cost estimate, an addictiveness rating, and likely mental/mood effects — all one JSON object from a single AI call.

**Grounding in `framework.md`**: before prompting, the main process reads `framework.md` off disk (repo root, resolved relative to the bundled `out/main/index.js` — same relative-path pattern as the window icon) and extracts just the "§6 Entertainment & Leisure Rules" section via regex, then prepends it to the prompt as "the user's own stated criteria — judge against THIS, not generic assumptions." Falls back to a generic framing if the file can't be found (e.g. after packaging, where it wouldn't be bundled) — verdicts still generate, just without personalization. A user's own free-text notes field sits alongside the AI verdict always, regardless of what the AI said.

Advisory only — every field is informational, nothing blocks adding or keeping an activity regardless of verdict, matching the "informative only, never a gatekeeper" default `framework.md` §6 recommends.

### Library — Books & Videos

- **Books**: title + an optional custom local file path to a PDF (native file-browse dialog, not just typed text). If a path is given, the adding machine's hostname is stored alongside it (`os.hostname()`) — since a book list will eventually sync via Drive while the PDF file itself stays local to one machine, clicking "open" on a book added elsewhere shows a warning badge instead of silently failing. The cover shown is the PDF's actual first page, rendered client-side via `pdfjs-dist`'s browser build on a canvas in the renderer (no native `canvas` module needed — deliberately avoided per the sql.js rationale above); it falls back to a generated gradient card with the title if rendering fails.
  - **Bookmark — automatic, in-app**: clicking a book opens the PDF in a dedicated Electron window using Chromium's own built-in PDF viewer (`webPreferences.plugins: true`), not an external app. That viewer updates the window's URL as `#page=N` while the user scrolls — and since it's our own window, the main process can observe that via `did-navigate-in-page` and simply remember the last page it saw. When the window closes, that page is written to the book's `bookmarkPage` automatically and pushed back to the UI (`book:bookmarkUpdated` over IPC) — no manual "what page were you on" step. This sidesteps the real constraint: neither Adobe nor Foxit expose any API for "what page is the user currently on," so automatic tracking is only possible for a viewer we control.
  - **External reader (optional, no auto-bookmark)**: a small link-out icon on each book card opens it with a configured external reader instead (Settings → auto-detect Adobe/Foxit's common install paths, or Browse to a custom `.exe`), landing on the saved page via `/A "page=N"`. Without one configured, it opens via the OS default handler through a `file://…#page=N` URL, which Chromium-based defaults (Edge, Chrome) honor. This path exists for people who want their own reader's UI, but the bookmark won't update automatically afterward — there's no way to observe another process's state from outside it.
- **Videos**: paste a YouTube video or playlist URL; the main process calls YouTube's public oEmbed endpoint (no API key) for the title, then fetches and inlines the thumbnail as a `data:` URI — verified working end-to-end during the build. Playlist thumbnail support is whatever oEmbed returns for that URL; no separate playlist-specific lookup yet.
- Both cover/thumbnail images are fetched or rendered once and stored as `data:` URIs in the DB — nothing re-fetches over the network on every app open, consistent with the local-first principle.

**To run it**: `npm install` once at the repo root, then `npm run dev` — opens the Electron window with hot reload for the renderer (main-process changes need a restart of `npm run dev`). `npm run typecheck` runs TypeScript across the whole workspace with no build step.

**A gotcha specific to automated/CI shells** (not your normal terminal): if `ELECTRON_RUN_AS_NODE=1` is set in the environment, `electron.exe` runs as plain Node instead of launching the actual Electron runtime, and it fails with `Cannot read properties of undefined (reading 'whenReady')`. This var gets set by some Electron-based tooling (including the shell this app was built in) for its own child processes. If you ever hit that error, `echo $ELECTRON_RUN_AS_NODE` — if it prints `1`, unset it before running (`env -u ELECTRON_RUN_AS_NODE npm run dev` in bash, or just open a fresh terminal window, which normally won't have it set).

Two build-time gotchas worth remembering if the package structure changes:
- electron-vite's dev runner always expects `out/main/index.js` and `out/preload/index.js` — a custom Rollup `input` filename gets overridden back to `index.js` via `output.entryFileNames` in `electron.vite.config.ts`.
- `externalizeDepsPlugin` only reads the **local** `package.json` (`apps/desktop/package.json`) to decide what to leave un-bundled — a runtime dependency declared only in a workspace package (like `sql.js` in `packages/db`) has to also be listed in `apps/desktop/package.json`, or it gets bundled incorrectly and breaks at runtime.
