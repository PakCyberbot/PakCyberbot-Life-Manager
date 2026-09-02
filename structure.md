# LIFE Manager — Planning Doc

Status: **v1 desktop running, first packaged installer built** — every module in §11 is implemented, and `npm run dist` produces a real Windows installer (unsigned, no auto-update yet). This file is still the living architecture doc; edit freely as things evolve.

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
- ~~**Earning Ways**~~ — built in v1 (§11); linking to Skills once that module exists is still future work
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

### Earning Ways (built in v1 — see §11 for the real schema/flow)

Superseded by what actually shipped. `linkedSkillIds` and tying actual earnings back to Money's transactions remain future work — both depend on modules/UI that don't exist yet (Skills, and a way to tag a Transaction to an EarningWay).

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
6. Use the app for real for a bit, note friction points, then decide what v1.1 fixes vs what's a v2 module (Entertainment, Earning Ways, Habits, ...) — done, most of v2's list shipped (Entertainment, Earning Ways, Jobs, Health, File Manager, News & Updates, Library Web Links)
7. ~~Once desktop v1 is usable daily, add `apps/mobile` via Capacitor~~ — done (see §12): scaffold, its own `capacitorDriver.ts`, a full mobile-specific UI reusing `packages/core`'s stores as-is (not `packages/ui`'s screens — mobile isn't a port of desktop's UI), mobile Drive sync, Android share-intent capture, and real editing (not just viewing) for Goals/Library/Savings plus a working News refresh.

## 12. Mobile app — started as a read-mostly companion, now genuinely editable in places

Built per an explicit ask: not a replica of desktop, but a **companion** sharing the same data (via Drive sync) with its own, deliberately smaller UI — it started strictly read-mostly, but Goals, Library, and Savings have all since grown real add/edit/delete, and News can refresh itself, following requests to make the phone genuinely useful rather than just a mirror.

**Product shape**: Dashboard shows the same goals/events/savings/quotes desktop's Dashboard does, plus today's Time Table rendered as the Clock view (`TimeTableClock`, reused byte-for-byte from `packages/ui` — it turned out to have zero Electron/platform coupling, pure props-in-SVG-out). Calendar, Entertainment, Earning Ways, Jobs, and Health stay **view-only** — mobile still never runs its own AI/job-fetch calls itself. File Manager doesn't exist on mobile (desktop-local-filesystem concept, no mobile equivalent). **Goals, Library, and Savings are all editable**: Goals gets a full per-goal task list (tap a card) plus a Quick-Tasks section for capturing a task with no goal yet; Library can add and open a PDF from the phone's own storage, not just Books/Videos/Web-Links added by URL; Savings can log entries and manage the wishlist. Both Goals and Savings gate their editing behind an explicit top-right "Edit" toggle — a deliberate small-screen safety measure so a stray tap can't misfire into a delete.

**Architecture**: `apps/mobile` is its own Vite + React + Tailwind app wrapped by Capacitor, with its own bottom-tab-navigation UI (not `packages/ui`'s sidebar-based `App.tsx`) — but it reuses `packages/core`'s Zustand stores completely unmodified, because those stores only ever call `getApi()`, never Electron/IPC directly, exactly the seam §2/§7 originally described. What's genuinely new: `packages/db/src/capacitorDriver.ts` (a `DataStore` implementation on `@capacitor-community/sqlite`, running the identical `schema.ts` so the two apps' database files stay interchangeable) and `apps/mobile/src/api/mobileApi.ts` (mobile's `window.api`, implemented directly in the same JS context rather than over IPC to a separate main process — `CapacitorHttp` being enabled in `capacitor.config.ts` is what makes this possible without hitting WebView CORS on third-party fetches). Three custom native Android plugins exist for capabilities Capacitor's own plugin catalog doesn't cover: a loopback OAuth listener for Drive sync, a FileProvider-based file opener for PDFs, and Android share-sheet capture — all app-local, all detailed in CLAUDE.md.

Full technical detail — the CORS/CapacitorHttp mechanism, the Web-Crypto secret-encryption interop with desktop's Node-crypto version, the raw-`.sqlite` backup/Drive-sync format, every editable-section addition, and the local dev-environment gotchas hit getting a real build running in an emulator (Gradle/JDK and Android-emulator TLS trust-store issues, both environment quirks rather than code bugs) — lives in CLAUDE.md's "Mobile app" section rather than duplicated here.

**Also shipped**: a **status bar overlap fix** (content was drawing under the system status bar — fixed with CSS `env(safe-area-inset-top)`, since the native `@capacitor/status-bar` JS call alone wasn't enough on this Android version's enforced edge-to-edge), **Time Table local notifications** (a weekly recurring reminder per slot, toggle in Settings, using `@capacitor/local-notifications`), and the app's own launcher icon (regenerated from the same source `packages/ui/src/assets/logo.png` desktop's icon uses, via `@capacitor/assets`) in place of Capacitor's stock default.

## 11. V1 desktop — build status & how to run

The desktop app is scaffolded and running, branded as **PakCyberbot Life Manager** (window icon + sidebar mark from `logo.ico`/`logo.png` at the repo root). What exists right now:

- **Screens**: Dashboard (today view across all modules + a random Quotes card + Today's Time Table), Goals (cards + progress + milestones + **Tasks live here now, not a standalone screen** — see below), Calendar (month grid, click a day to view/add events), **Time Table** (recurring weekly routine — see below), **Savings** (personal total + wishlist, not full bookkeeping — see below), **Library** (Books & Videos, with a per-goal category tag), **News & Updates**, **Entertainment**, **Earning Ways**, **Jobs**, **File Manager**, **Health** (see below for all these), Settings (theme, default currency, PDF reader config, quotes management, Google Drive sync, local backup export/import, AI provider + keys, News categories, Entertainment criteria, Job searches, per-module Sections toggles)
- **Theme**: light/dark/system, toggled from the sidebar or Settings, persisted per-device in `localStorage`; primary accent shifted to a green matching the new logo, plus per-module accents including rose for Library and teal for Health
- **Window**: opens maximized by default ("full screen" in the everyday sense — fills the screen but keeps the title bar/taskbar, unlike OS kiosk fullscreen which hides all window chrome)
- **Data**: everything persists locally to `%APPDATA%/PakCyberbot Life Manager/life-manager.sqlite` via sql.js — closing and reopening the app keeps your data
- Cross-module linking (`links` table) exists in the schema at a basic level, largely superseded by Tasks' own link field (see below) for the goal↔library case; recurrence, notifications, and the v2/v3 modules from §5 (other than Library) are not built yet

### Life Quotes

A `quotes` table (`text`, `author?`), seeded with 5 defaults on first launch only (2 from you, 3 written for the app — none attributed to a real person, to avoid ever misattributing a quote someone didn't actually say). Managed entirely from Settings (add/delete); the Dashboard shows one at random each time it's opened, with a shuffle button to see another without leaving the page.

### Goals & Tasks — tasks live inside a goal, but don't have to

Tasks were originally their own sidebar screen; per a later ask, they moved into each Goal's detail dialog, created and viewed from there rather than a global to-do board — but `linkedGoalId` is optional again after a further ask: a task with none is a **"quick task"**, captured before it's clear which goal (if any) it belongs to. A permanent "Quick Tasks" section below the goals grid lists them, each assignable into a goal (and optionally one of its milestones) via a small picker dialog. Tasks can also nest one level deeper under a specific milestone (`linkedMilestoneId`) instead of sitting at goal-level — milestones are expandable in the detail dialog, showing their sub-tasks as milestone-style checkboxes, an inline quick-add, and an "assign existing" picker so a task can be pulled in from anywhere (a quick task, or one currently under a different goal/milestone) rather than only ever created fresh. Tasks are fully editable after creation too (a pencil icon opens the same dialog used to add one, pre-filled, calling `updateTask` instead of `addTask`). Each task can optionally carry **one link** (`linkType`: `file` | `folder` | `url` | `book` | `video`):

- **File/folder**: same `dialog:pickFileOrFolder` + hostname-gating as File Manager (`linkPath`/`linkHostname`) — opening only works on the machine it was added from, a disabled-looking icon otherwise.
- **Web URL**: a plain link (`linkPath` holds the URL, `linkHostname` stays null — a URL isn't machine-specific), opened via `system.openExternal`.
- **Book/video**: picked from a dropdown of existing Library items (`linkTargetId` holds the Book/Video's id). Linking one **tags that book/video's new `category` field with the goal's title** — so opening Library shows a "Goal name" badge on any book/video pulled in by a task, answering "which of my books/videos are working toward which goal?" without a separate join UI. Clicking the task's link jumps straight to Library and scrolls/highlights that exact card, via a tiny cross-screen signal store (`useUiFocusStore` — Library consumes `libraryFocus` once, switches to the right tab, highlights the card, then clears it so it only fires once per navigation). Deleting or relinking the task clears that badge again (checked against every other live task first, since `category` holds one value, not a set) — the original version left it dangling, fixed after being confirmed to linger.

**Goal fields are editable** (title, description, category, type, target date, status) directly in the detail dialog — text fields commit `onBlur` against local state so typing doesn't fight the parent's `goals.find(...)` object identity, resynced only when the dialog switches to a *different* goal. Each goal also gets an image: fetched automatically from Wikipedia by title when the goal is created (same real-search API Entertainment's posters use, no AI-guessed URL), with manual remove/upload controls in the detail dialog for when nothing real matches (common for personal/abstract titles) or the auto-match is wrong.

**Progress auto-computed from milestones and their sub-tasks**: once a goal has at least one milestone and/or milestone-linked task, `progressPct` is derived as `completedUnits / totalUnits` (a milestone and a sub-task are equal-weight units) rather than set by hand — `useMilestonesStore`'s milestone mutations and `useTasksStore`'s task mutations (whenever they touch a milestone-linked task) all call a shared `syncGoalProgressForGoal()` helper, which recomputes and pushes the percentage to `useGoalsStore` directly. This is now a genuine two-way store dependency (milestones store reads live tasks, tasks store calls back into the milestones store's exported sync function) rather than the original one-directional cross-store call — safe under ESM's live-binding semantics since neither side touches the other at module-eval time, only from inside an async function body, confirmed by a clean production build and a dev-mode boot. The manual progress trackbar becomes `disabled` in the UI once there's at least one unit to derive from; a goal with none keeps manual control. Removing the last milestone/sub-task doesn't reset progress to 0 — it just leaves the last computed value and hands manual control back.

### Savings — a personal total + wishlist, not full bookkeeping

Money was simplified, per a later ask: daily-expense bookkeeping (separate accounts, per-transaction categorization, monthly budgets) was more machinery than wanted — what's actually useful is "what's my total" and "what am I saving toward." `savingsEntries` (amount + `add`/`expense` + date + optional note) replaces accounts/transactions; the total is just their signed sum (`computeTotalSavings`). `wishlistItems` (title, category — purchase/trip/subscription/investment/other —, estimated cost, status) is the "what am I saving toward" half, editable/removable, with a running total of everything still `planned`. The original `accounts`/`transactions`/`budgets` tables and types are kept **dormant** in the schema (not dropped) rather than risking a destructive migration without the user's explicit say-so — nothing in the UI reads/writes them anymore. The sidebar label is "Savings"; the internal `ToggleableSectionId`/screen id stayed `money` to avoid an unnecessary rename across Settings/Sidebar/App routing.

**Marking a wishlist item purchased actually deducts from savings, and it's undoable/editable.** `WishlistItem.purchaseEntryId` links a `'done'` item to the exact `SavingsEntry` created for it (an expense for `estimatedCost`, skipped if no cost was ever set). Leaving `'done'` — back to `'planned'`, or `'cancelled'` — removes that same entry, so undoing a purchase (or correcting a mistaken "done") never leaves a phantom transaction behind. Editing the cost on an already-purchased item (via the wishlist edit dialog, previously missing entirely — only add/status/delete existed) updates the linked entry's amount too, for when the real price ended up cheaper or pricier than the estimate.

### Google Drive sync — implemented and verified working end-to-end

Settings has a real **Push to Drive** / **Pull from Drive** pair, not a placeholder — live-tested through a full connect → push cycle, which is how the two bugs below were actually found (both looked like success at first glance; see CLAUDE.md's Google Drive sync section for the full diagnosis). How it works:

- **Scope**: `drive.file` — the app can only ever see files/folders *it* creates, never the rest of your Drive. This matters practically: broader scopes require Google to review/verify the app before it'll work for anyone but you in "testing" mode; `drive.file` avoids that entirely, which is exactly what a personal single-user app wants.
- **Push**: finds-or-creates a folder literally named "PakCyberbot Life Manager" in your Drive root, then creates or overwrites `life-manager.sqlite` inside it.
- **Pull**: downloads that file and overwrites the local DB — after confirming with you first, since it discards anything added locally since the last push. On success, the app relaunches itself (`app.relaunch()` + `app.exit()`, which skips the normal shutdown flush, so the just-pulled file can't get overwritten by stale in-memory data) so every cache — the DB and all the Zustand stores — reloads clean from the pulled file, rather than trying to hot-patch a dozen different in-memory caches individually.
- **Auth**: the standard installed-app OAuth loopback flow (RFC 8252) — a temporary `127.0.0.1` server catches Google's redirect after you approve access in your normal browser, no embedded webview. Refresh token stored in the local `settings` table.
- **Implementation**: plain `fetch` calls against the Drive v3 REST API and Google's OAuth token endpoint (`apps/desktop/electron/driveSync.ts`) — deliberately not the `googleapis` SDK, which is tens of MB for the handful of calls this needs.

**One-time setup, in full** (this used to just say "see the setup steps in chat" — inlined here instead, since a chat transcript isn't documentation anyone can come back to):

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create/select a project.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → User type **External** → fill in the required fields → add your own Google account under **Test users** (the app stays in "Testing" status; unverified apps cap out at 100 named testers, which is exactly what a personal app needs).
4. Still on the consent screen: **Edit app → Scopes → Add or remove scopes** → add `https://www.googleapis.com/auth/drive.file` (plus `openid` and `.../auth/userinfo.email` if not already present) → save. **This step is easy to miss and silently breaks Push/Pull later** — requesting a scope in the authorization URL is not enough by itself; Google only actually grants a scope that's also registered here, and drops anything else without an error at consent time. The symptom shows up downstream instead, as `403 insufficient authentication scopes` on the first Push.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type **Desktop app** (not "Web application" — that type requires pre-registering an exact redirect URI, and this app's loopback server binds a fresh random port every time, so there'd be nothing fixed to register; "Desktop app" clients skip that field entirely and Google permits any `http://127.0.0.1:<port>` redirect for them under RFC 8252).
6. Copy the **Client ID** and **Client Secret** into Settings → Google Drive sync, then **Connect Google Drive**. Expect an "unverified app" warning in the browser (the app isn't published/verified) — click **Advanced → Go to [app name] (unsafe)** to proceed; this is normal for a personal, unpublished OAuth app.
7. If you registered the `drive.file` scope *after* already connecting once, **Disconnect then Connect again** — refreshing an existing token can never grant it a scope it wasn't issued with originally; only a fresh consent screen visit can.

### Local backup — export/import, no Google account needed

A plain file-copy alternative to Drive sync, for anyone who'd rather not set up Google credentials at all, or just wants an ad-hoc backup before trying something risky. Two buttons in Settings:

- **Export**: `store.flush()` (a new `ElectronDataStore` method — forces an immediate synchronous write, distinct from `close()`, which also shuts the store down) guarantees the copy reflects the truly latest state rather than whatever the last debounced autosave happened to write, then a native save dialog + `fs.copyFileSync` copies `life-manager.sqlite` wherever the user picks.
- **Import**: a native open dialog, a cheap sanity check (SQLite files always start with the 16-byte magic header `"SQLite format 3\0"` — verified against a real DB file during the build, since it's easy to get the exact bytes wrong; this guards against overwriting real data with an unrelated file the user misclicked), then the same confirm-first / overwrite / `app.relaunch()` + `app.exit()` pattern as Drive's pull, for the same reason: guarantee every in-memory cache reloads clean rather than hot-patching each one.

### Time Table — a recurring weekly routine, not Calendar

Sits right below Calendar in the sidebar, and is deliberately a different concept: Calendar events are tied to a specific date; Time Table is a **weekly template** that repeats forever — "every Monday, 9–10:30 is deep work" — keyed by day-of-week (0=Sun..6=Sat) rather than a date.

- **`daySchedules`**: exactly 7 rows, one per day-of-week, seeded once on first launch (`07:00`–`23:00` default) and only ever updated afterward, never added to or deleted — there's always exactly one schedule per day of the week, by construction.
- **Awake time**: computed client-side (`minutesBetween`/`formatMinutes` in `packages/shared`) as the gap between that day's wake and sleep time, with overnight wrap handled (a sleep time numerically earlier than wake time, e.g. sleeping at 01:00, adds 24h before subtracting) — verified with a small unit test during the build alongside the seed/CRUD flow itself (exercised directly against the running store, no UI needed, since none of this touches a native dialog).
- **"Any selected days" bulk editing**: per the user's specific ask — editing one day's wake/sleep is the default, but "Apply this to other days…" opens a multi-select of the remaining 6 days and copies the current day's times onto all of them at once (`applyScheduleToDays`), rather than requiring one-at-a-time edits for a schedule that's usually the same across weekdays.
- **`timeSlots`**: any number per day-of-week, each a label + start/end time + optional notes/color, sorted by start time. A progress bar shows scheduled-vs-awake minutes for the currently viewed day. Slots are editable after creation (pencil icon reopens the same add dialog, pre-filled) and clonable to other days (`cloneSlotToDays` — a "Clone to other days…" multi-select mirroring `applyScheduleToDays`'s pattern, but for a single slot's time/label/notes/color instead of the whole day's wake/sleep window).
- **Today's Time Table on Dashboard**: a read-only card showing the current day's wake/sleep window and its `timeSlots`, sorted by start time, with a link to the full Time Table screen — so the day's plan is visible without leaving Dashboard, per the user's specific ask.
- **Clock view** (`packages/ui/src/components/timetable/ClockView.tsx`): an alternative to the plain list, toggled per the user's ask for something "more creative" — two analog 12-hour clock faces (AM: 12am–12pm, PM: 12pm–12am) drawn as inline SVG, each with a colored ring showing exactly which hours are covered by which slot, like a daily activity-ring chart drawn as a real clock instead of a bar. The asleep window (the gap between `sleepTime` and the next `wakeTime`) renders as a low-opacity ring segment so it visually recedes, while every real time slot keeps full color — curved on-ring text at this size would be unreadable, so a legend underneath carries the labels/time-ranges while the ring itself communicates *coverage* at a glance. Core math: `toDecimalHours` (`"09:30"` → `9.5`), `splitIntoClockSegments` (splits a possibly-overnight-wrapping `[start, end)` range across up to three 12-hour windows — AM, PM, and a third `[24,36)` window that maps back onto the *same* AM face for a range that wraps past midnight, e.g. sleep `23:00`–`07:00` becomes a PM segment `330°→360°` plus an AM segment `0°→210°`), and `describeArc` (polar-to-Cartesian + SVG arc path, splitting a would-be full 360° arc into two 180° arcs since a literal 0°-sweep-360° path degenerates to a single point in SVG). All three were verified against 6 cases — a plain AM slot, a plain PM slot, one spanning the AM/PM boundary, an overnight wrap, and both all-AM/all-PM full-day arcs — via a standalone Node script before wiring into the component, since there's no test suite to catch a math mistake otherwise.

### Date/time inputs — click anywhere to open the native picker

Chromium's native `<input type="date">`/`time`/`datetime-local"` only opens its calendar/clock popup when you hit its small indicator icon exactly — otherwise it just looks like a plain text field you have to type into, which is what prompted this fix. The shared `Input` component (`packages/ui/src/components/ui/FormControls.tsx`) now calls the input's own `showPicker()` on click anywhere in the field for those types, same effect as clicking the icon precisely. Paired with a `color-scheme: light`/`dark` CSS rule (toggled alongside the `.dark` class ThemeProvider already sets) so the native popup and its icon actually render in a color scheme that's visible against a dark-mode field, rather than the icon defaulting to a barely-visible dark-on-dark render. Applies everywhere in the app that uses `Input` with one of those types — no per-screen changes needed.

### AI providers — API key only, by design

Settings has an "AI provider" section supporting **Gemini, OpenAI, and Anthropic (Claude)**, each via its own API key (`apps/desktop/electron/ai/providers.ts`), switchable instantly. This is deliberately **not** "log in with your ChatGPT Plus / Claude Pro subscription" — that isn't a real integration path for a third-party app: OpenAI bills API usage completely separately from ChatGPT Plus by design, and Claude's subscription access is scoped to Anthropic's own apps (Claude.ai, Claude Code — which built this feature). The only way to fake subscription-login access would be scraping the web app's session, which violates both platforms' Terms of Service and risks the account — not implemented, and won't be.

Model names are pinned as constants and **will** go stale — this was discovered firsthand mid-build when a live test against `gemini-2.5-flash` came back `404` with the API itself recommending `gemini-3.6-flash` as the replacement. If a provider starts failing, check the model constant first.

### AI provider status — "is it working right now," not "how many credits are left"

None of the three providers expose a real remaining-credits/quota number for their free or pay-as-you-go tiers, so a literal "credits check" isn't something that can be built honestly. What's built instead: `checkAiHealth()` (`apps/desktop/electron/ai/health.ts`) makes a real, minimal completion request — the exact same `callAI()` path every AI feature uses — and reads whether it succeeded. A cheaper metadata-only `GET /models` request was tried first and found to be actively misleading: live-tested against a Gemini key whose real generation quota was exhausted (confirmed via a genuine Entertainment-verdict call failing with `429`), `GET /models` still returned `200` — Gemini meters `generateContent` and `models.list` on separate quotas, so checking the lighter endpoint reported "OK" for a provider that, for every AI feature in this app, wasn't. A real completion costs a sliver of the same quota real usage does, but it's the only check that's actually honest. A 429, or an error body containing "quota"/"RESOURCE_EXHAUSTED"/"rate limit", is classified as `rateLimited: true` specifically, distinct from a bad key or a network error.

Two ways this status gets updated:
1. **Explicit** — Settings' "Check now" button (`ai:checkStatus` IPC) makes the check on demand.
2. **Ambient** — after any real AI feature call (News, Entertainment, Earning Ways, Jobs, Food) fails, `main.ts` consults `providers.ts`'s `getLastAiError()` (every provider call now records the HTTP status/body of its last failure there, cleared on success) and updates the same status without a second network request — so a quota failure surfaces immediately, not just the next time someone happens to click "Check now."

The result is pushed to every renderer window via an `ai:statusChanged` event (same push-event pattern as `book:bookmarkUpdated`), consumed by a shared `useAiStatusStore` so Settings' full status panel and the Sidebar's compact warning banner (shown only when the active provider isn't OK, wording differing for "usage limit reached" vs. general "unavailable") stay in sync without either one polling.

### Encrypted settings

Any settings key that holds a credential (`googleClientId`, `googleClientSecret`, `googleRefreshToken`, `geminiApiKey`, `openaiApiKey`, `anthropicApiKey`) is transparently encrypted at rest with AES-256-GCM (`packages/db/src/secretCrypto.ts`), keyed off a hardcoded app passphrase — `getSetting`/`setSetting` encrypt/decrypt automatically, so callers never see ciphertext. Honest caveat documented in the code: a hardcoded key can't stop someone with the app's own source from deriving it — there's no server-side secret to lean on in a purely local app. What it does protect against, and the actual point of it, is the far more likely case: the raw `.sqlite` file (or a cloud backup of it, or another process scanning disk) exposing API keys just by being opened in a viewer. Verified during the build by grepping the raw DB file for a real seeded key — absent in plaintext, present as `enc:iv:tag:ciphertext`.

### News & Updates

Real articles with guaranteed-real links, not an AI's guess at a URL. The design came out of a live finding: Gemini's "Google Search grounding" tool (the obvious way to get an LLM to cite real sources) turned out to require a billing-enabled Google Cloud project even on an otherwise free-tier key — confirmed by hitting a `429 "check your plan and billing"` specific to that tool while plain calls worked fine. So instead (`apps/desktop/electron/ai/news.ts`):

1. Real articles come from **Google News RSS** (`news.google.com/rss/search?q=…`) — free, keyless, no billing, confirmed live to return same-day dated results with working links.
2. The configured AI provider ranks/prioritizes them and writes a one-line "why it matters" per item — referenced back to the original RSS item **by list index**, not by asking the AI to reproduce a title or URL, so a real link is guaranteed even if the AI paraphrases.
3. If no AI provider is configured, or the AI call fails for any reason, it falls back to showing the raw RSS results unranked/unsummarized rather than showing nothing.

**Categories** (`newsCategories` table): one editable **custom** category (name + prompt — seeded as "Cybersecurity" per the user's own example), plus three fixed built-ins — **Global Politics** (fixed prompt), **Country** and **City** (need a location set in Settings before they'll fetch). More custom categories can be added freely. Each category's latest fetch replaces the previous one wholesale (`newsItems`, hard-deleted and reinserted via `ElectronDataStore.replaceNewsItems` — a live digest, not a growing archive) rather than going through the generic soft-delete `remove()`, so refreshing repeatedly doesn't bloat the DB. Refresh is manual (a button per category), not automatic, to stay mindful of free-tier AI quotas.

**Blogs & Websites** — a 5th category type (`blog`), different in kind from the other four: rather than an RSS-sourced, AI-summarized digest, the user pastes a blog or news site's own URL and gets a real, scrollable, in-app view of that live page — for a quick skim of "what's new," not a summary of it. Shown as its own horizontally-scrolling strip of site-preview cards on the News screen, visually distinct from the vertical list of digest sections. Two technical constraints ruled out the obvious "just embed it" approach: this app's Content-Security-Policy has no `frame-src` (so any `<iframe>` is blocked outright by the app's own CSP before it would even reach the target site), and most real news/blog sites set `X-Frame-Options`/`frame-ancestors` themselves, which would block embedding a second time over even without the CSP. The fix reuses the same trick as Library's in-app PDF reader below: a dedicated, app-controlled `BrowserWindow` doing a genuine top-level page load (`system:openWebsite`) — not "framing" in any sense, so neither restriction applies. The card's own preview image/favicon are fetched from the page's real `og:image`/favicon (see Library's Web Links below — the fetch is shared between both features).

### Entertainment — "worth your time" verdicts

The first real use of `framework.md` as AI context, exactly as originally designed in §4's guiding principles. Add a title + type (movie/show/anime/game/book/other); the row appears immediately (`considering` status) and a verdict fills in asynchronously a moment later, same non-blocking pattern as Library's cover/thumbnail fetch. The verdict (`apps/desktop/electron/ai/entertainment.ts`) covers exactly what was asked for: a **Worth It / Mixed / Skip** call, reasoning, skills it could build, genuine benefits, a realistic time-cost estimate, an addictiveness rating, and likely mental/mood effects — all one JSON object from a single AI call.

**Grounding in `framework.md`**: before prompting, the main process reads `framework.md` off disk (repo root, resolved relative to the bundled `out/main/index.js` — same relative-path pattern as the window icon, via the shared `apps/desktop/electron/ai/framework.ts` helper) and extracts just the "§6 Entertainment & Leisure Rules" section via regex, then prepends it to the prompt as "the user's own stated criteria — judge against THIS, not generic assumptions." Falls back to a generic framing if the file can't be found (e.g. after packaging, where it wouldn't be bundled) — verdicts still generate, just without personalization.

**Settings-editable criteria too**: since editing a markdown file isn't the most discoverable way to steer this, Settings also has a plain "Entertainment verdict criteria" textarea (`entertainmentPrompt` setting) that layers on top of `framework.md` §6 in the same prompt — either can be used alone, or both together. A user's own free-text notes field sits alongside the AI verdict always, regardless of what either source said.

Advisory only — every field is informational, nothing blocks adding or keeping an activity regardless of verdict, matching the "informative only, never a gatekeeper" default `framework.md` §6 recommends.

**Poster/thumbnail — automatic**: manually hunting down and pasting a poster image isn't realistic for every entry, so by default one is looked up automatically from **Wikipedia's own free REST API** by title (+ a type-specific hint word — "film", "video game", "TV series", "anime", "book" — to disambiguate, e.g. "Inception" the word vs. the film) — `fetchWikipediaThumbnail()` in `main.ts`, resolving via `opensearch` first when the raw title doesn't hit a page directly. Same "never ask AI for a URL" discipline as News/Jobs/Earning Ways: this is a real search against a real source, never an AI-guessed link. The add dialog's image URL field is now optional and only needed to *override* the automatic pick; either way the URL (found or pasted) is fetched and inlined as a `data:` URI (`fetchImageAsDataUri`, shared with the YouTube thumbnail lookup below), and a miss just leaves the card without an image rather than blocking the add. Both the AI verdict and the thumbnail fetch fire concurrently and independently after the row is created, so neither one delays the other.

### Earning Ways — ideas + on-demand A-Z guides

Manual ideas (title + category + notes) plus AI suggestions, both landing in the same list. "Get AI suggestions" (`apps/desktop/electron/ai/earningWays.ts`) reads active Goal titles and `framework.md` §1 (Core Values) + §5 (Skill & Learning Framework) as context, returns up to 6 ideas with a one-line rationale each; the user picks which to actually add (never auto-added) via a checkmark/dismiss row, keeping the list opt-in rather than auto-populated.

Opening an earning way's detail dialog ("popup") generates the full guide on first open if not already cached — overview, getting-started steps, skills needed, tools/platforms, a timeline, income potential, common pitfalls, and resources — one JSON object from a single AI call, with a manual "Regenerate" option after that. Same discipline as News & Updates: **resources are requested as names, never URLs** — the AI is never asked to produce a link, so there's nothing to hallucinate.

### Jobs — real listings, aggregated, never scraped from sites that forbid it

Same News & Updates pattern applied to job search: real listings from free sources + AI ranking, never AI-invented listings or links. Deliberately does **not** scrape LinkedIn, Indeed, or Glassdoor — their Terms of Service explicitly prohibit it and they actively fight scrapers (LinkedIn has literally sued over this — *hiQ Labs v. LinkedIn*). Instead, `apps/desktop/electron/ai/jobs.ts` aggregates four sources built for exactly this kind of use, all free and keyless:

- **RemoteOK** (`remoteok.com/api`) — asks only for attribution in its terms
- **Arbeitnow** (`arbeitnow.com/api/job-board-api`) — supports server-side `?search=`
- **We Work Remotely** (`weworkremotely.com/remote-jobs.rss`) — a public RSS feed, meant for syndication
- **Jobicy** (`jobicy.com/api/v2/remote-jobs`) — asks for attribution + that application links stay as the original job URL (honored: job cards always open the exact URL the source provided)

All four are queried in parallel (`Promise.allSettled` — one source failing doesn't sink the others), normalized to a common shape, deduped by URL, sorted by recency, capped at 40 candidates. If an AI provider is configured, it ranks up to 10 against the search's prompt and writes a one-line fit note per pick — same index-based reference pattern as News, so a real link is guaranteed regardless of how the AI paraphrases a title. Without a provider (or if the AI call fails), it falls back to the top 15 raw results unranked rather than showing nothing.

**Settings-driven, per the user's ask**: "job searches" (`jobSearches` table — label, comma-separated keywords, an AI framing prompt for what to prioritize) are managed entirely from Settings, mirroring News categories exactly. The Jobs screen itself only displays saved searches + a Refresh button per section — no criteria live outside Settings, so "which types of jobs to list" always has one place to edit. Not seeded with a default search (job criteria is too personal to guess, unlike Quotes).

### Sections — show/hide any module from Settings

A single Settings card lists every toggleable module (`packages/shared`'s `TOGGLEABLE_SECTIONS` — Goals, Calendar, Time Table, Savings, Library, News, Entertainment, Earning Ways, Jobs, File Manager, Health; Tasks isn't listed — it lives inside Goals, not a standalone screen) with a switch each. Turning one off hides it from the sidebar entirely — not a disabled/greyed-out state, just gone, same as if that module didn't exist for you — and turning it back on brings it right back with all its data intact (nothing is deleted, only hidden). Dashboard and Settings are deliberately excluded from the list and can't be turned off, since disabling Settings would remove the only way back in to re-enable anything.

Stored as a single `disabledSections` setting (comma-separated list of the ones turned *off* — everything not listed defaults to on), so adding a new toggleable module later is one line in `TOGGLEABLE_SECTIONS` plus a `SECTION_META` entry for its label/icon in Settings, not a new settings key each time. If the section currently being viewed gets toggled off, `App.tsx` bounces back to Dashboard rather than leaving the user stranded on a screen no longer reachable from the sidebar.

### File Manager — hostname-gated folder/file links

Started as the one module that's off by default, then generalized into a proper **Sections** toggle in Settings (§11) — every module (this one included) can now be individually shown/hidden from the sidebar, not just File Manager. All default to on; toggle any off and it disappears from the sidebar entirely, not just its data — nothing is deleted, and re-enabling brings it right back.

**What it is**: a self-referencing category tree (`fileCategories.parentId`) the user builds themselves — e.g. Cybersecurity → Tools, Cybersecurity → Testing — with real folder/file paths (`fileLinks`) attached at any level. It's explicitly *not* a synced file store or a real file browser (no listing/previewing what's inside a linked folder) — just organized shortcuts to open things that already exist on disk, browsed the same way as any category-based screen in this app (breadcrumb + grid, "New category" / "Add link").

**Hostname gating, exactly as specified**: every link records the hostname it was added from (same `os.hostname()` pattern as Library's books). Viewing a category shows every link regardless of which machine added it — useful once Drive sync brings the category structure to another device — but clicking one is a genuine no-op unless its hostname matches the current machine's; `useFileManagerStore.openLink()` doesn't even call out to the main process on a mismatch, so there's no risk of it trying (and failing loudly) to open a path that was never valid on this device. The card shows "on `<hostname>`" instead of an open affordance in that case.

**Adding a link**: `dialog:pickFileOrFolder(kind: 'file' | 'folder')` opens exactly one native dialog for the requested kind — a real Windows/Linux limitation, confirmed against Electron's own docs, is that combining `openFile`+`openDirectory` in one dialog silently collapses to a directory-only picker on those platforms (only macOS can offer both as a real toggle), so the original version quietly never let a file be selected. Every call site now shows separate "Browse file"/"Browse folder" buttons instead. `fs.statSync` in the main process still confirms folder-vs-file once at add time as a safety net. Opening later goes through `system:openLocalPath`, which wraps `shell.openPath` — the same call handles both a folder (opens it in Explorer) and a file (opens it with its default app), so no branching is needed there either.

**Deleting a category cascades**: removing a category also soft-deletes every descendant category and every link inside any of them (`collectDescendantIds`, a plain breadth-first walk over `parentId` — unit-tested against a 4-level nested tree during the build) rather than either blocking the delete or silently orphaning children.

### Health — exercise, appointments, nutrition, body metrics

One screen (`HealthScreen.tsx`), four tabs, one combined `useHealthStore` — a teal `accentHealth` identity distinct from every other module. Per the user's ask ("you can add any other section within this health section if you want"), a fourth sub-area (Body Metrics) was added beyond the three explicitly requested, since it reuses the existing simple-dated-log pattern and fits the theme without needing a charting library.

- **Exercise Schedule**: repeats weekly by `daysOfWeek` (comma-separated day-of-week numbers), same underlying idea as Time Table's `dayOfWeek` keying but per-exercise rather than one row per day — an exercise can be assigned to any subset of days at once (e.g. "1,3,5" for Mon/Wed/Fri) via a multi-select in the add dialog, rather than requiring one row per day. Category (strength/cardio/flexibility/other) drives the icon; duration/sets/reps are all optional since not every exercise fits that shape (e.g. a 30-minute walk has duration but no sets/reps). Optionally carries a reference `videoUrl` (e.g. a YouTube form demo) — its thumbnail is fetched the same way as Library's video thumbnails (`media.fetchYouTubeThumbnail`), and a Play icon on the row opens it externally.
- **Doctor Appointments**: date-specific (`appointmentAt`, an ISO datetime — unlike Exercise's weekly recurrence), sorted chronologically. Upcoming vs. past is computed at render time by comparing to `Date.now()`, not a manual status field the user would have to maintain — a `Past` badge and dimmed styling apply automatically once the appointment's time has elapsed.
- **Food & Nutrition — the AI feature this section was built around**: add a food's name + quantity + optional price; the row appears immediately and an AI call (`apps/desktop/electron/ai/food.ts`) fills in benefits, a calorie estimate, and any moderation considerations moments later — identical non-blocking pattern to Entertainment's verdict (`pendingFoodIds` tracks in-flight rows so the card can show a "Getting nutrition info…" state instead of leaving stale blanks). One JSON object per call: `{benefits, caloriesEstimate, considerations}`. Not grounded in `framework.md` (unlike Entertainment/Earning Ways) — nutrition facts don't depend on the user's personal values the way "is this worth my time" or "what should I pursue" do.
- **Body Metrics**: a simple dated weight log (`date`, `weight`, `unit` — free text so `kg`/`lb` both work without an enum), newest-first, with a computed delta against the previous entry (green ↓ / red ↑) shown inline — pure client-side arithmetic, no AI involved.
- **Overview strip**: four `StatCard`-style tiles at the top (today's exercise count, next appointment, foods logged this week, latest weight) each jump straight to their tab on click — same interaction pattern as Dashboard's own stat cards linking out to full screens.
- No seed data — health data is personal, so (unlike Quotes or News categories) all four tables start empty for every new install.

### Library — Books, Videos & Web Links

- **Books**: title + an optional custom local file path to a PDF (native file-browse dialog, not just typed text). If a path is given, the adding machine's hostname is stored alongside it (`os.hostname()`) — since a book list will eventually sync via Drive while the PDF file itself stays local to one machine, clicking "open" on a book added elsewhere shows a warning badge instead of silently failing. The cover shown is the PDF's actual first page, rendered client-side via `pdfjs-dist`'s browser build on a canvas in the renderer (no native `canvas` module needed — deliberately avoided per the sql.js rationale above); it falls back to a generated gradient card with the title if rendering fails.
  - **Bookmark — automatic, in-app**: clicking a book opens the PDF in a dedicated Electron window using Chromium's own built-in PDF viewer (`webPreferences.plugins: true`), not an external app. That viewer updates the window's URL as `#page=N` while the user scrolls — and since it's our own window, the main process can observe that via `did-navigate-in-page` and simply remember the last page it saw. When the window closes, that page is written to the book's `bookmarkPage` automatically and pushed back to the UI (`book:bookmarkUpdated` over IPC) — no manual "what page were you on" step. This sidesteps the real constraint: neither Adobe nor Foxit expose any API for "what page is the user currently on," so automatic tracking is only possible for a viewer we control.
  - **External reader (optional, no auto-bookmark)**: a small link-out icon on each book card opens it with a configured external reader instead (Settings → auto-detect Adobe/Foxit's common install paths, or Browse to a custom `.exe`), landing on the saved page via `/A "page=N"`. Without one configured, it opens via the OS default handler through a `file://…#page=N` URL, which Chromium-based defaults (Edge, Chrome) honor. This path exists for people who want their own reader's UI, but the bookmark won't update automatically afterward — there's no way to observe another process's state from outside it.
- **Videos**: paste a YouTube video or playlist URL; the main process calls YouTube's public oEmbed endpoint (no API key) for the title, then fetches and inlines the thumbnail as a `data:` URI — verified working end-to-end during the build. Playlist thumbnail support is whatever oEmbed returns for that URL; no separate playlist-specific lookup yet.
- **Web Links** (a 3rd tab): save any article/page URL to explore later. A preview thumbnail is fetched automatically — the main process requests the page's own HTML and regex-extracts its `og:title`/`og:image`/favicon (falling back to `/favicon.ico`), no HTML-parser dependency, consistent with how News & Updates already regex-parses RSS XML rather than pulling in a full parser for a handful of tags. A realistic desktop-browser `User-Agent` header is set, since plenty of sites silently reject or serve a stripped page to Node's default fetch UA — verified live against GitHub, Wikipedia, and Hacker News before wiring it in. This same fetch (`fetchWebPreview`) is shared with News & Updates' Blogs & Websites feature above. Opening a link goes to the OS default browser (`system.openExternal`), same as a Task's `url` link type — no in-app viewer needed here, unlike Books' PDF reader or Blogs & Websites' live-preview window.
- Cover/thumbnail/preview images are all fetched or rendered once and stored as `data:` URIs in the DB — nothing re-fetches over the network on every app open, consistent with the local-first principle.
- **Deleting is a hard delete, not the app-wide soft delete**: `removeBook`/`removeVideo`/`removeWebLink` call a dedicated `db.hardRemove` (genuine `DELETE FROM`, not `UPDATE … SET deletedAt`) rather than the generic `remove()` every other table uses — a deliberate exception, same category as `newsItems`/`jobListings` bypassing soft-delete. There's no "undo" value in keeping a deleted row around, and each one can carry a sizable `data:` URI image that shouldn't linger in the DB forever after an explicit delete.
- **Host filter dropdown**: appears next to the "Library" heading only when books have been added from more than one machine (`bookHosts`, distinct non-null `hostname` values). Selecting a host filters to books added from that machine, **plus every book with no `filePath` at all** — those have nowhere to "belong" to any one host, so they stay visible under every filter, marked with a "No file linked" badge (a `FileX` icon) distinct from the amber "on `<hostname>`" badge shown for a path that exists but isn't reachable from this machine.
- **Category badge**: a book/video shows a "goals"-toned badge with the linked goal's title when a Task has tagged it (`category` field) — see the Goals & Tasks section above. Jumping to a specific item from a Task's link uses `useUiFocusStore` to switch tabs and scroll/highlight the right card.

**To run it**: `npm install` once at the repo root, then `npm run dev` — opens the Electron window with hot reload for the renderer (main-process changes need a restart of `npm run dev`). `npm run typecheck` runs TypeScript across the whole workspace with no build step.

**A gotcha specific to automated/CI shells** (not your normal terminal): if `ELECTRON_RUN_AS_NODE=1` is set in the environment, `electron.exe` runs as plain Node instead of launching the actual Electron runtime, and it fails with `Cannot read properties of undefined (reading 'whenReady')`. This var gets set by some Electron-based tooling (including the shell this app was built in) for its own child processes. If you ever hit that error, `echo $ELECTRON_RUN_AS_NODE` — if it prints `1`, unset it before running (`env -u ELECTRON_RUN_AS_NODE npm run dev` in bash, or just open a fresh terminal window, which normally won't have it set).

Two build-time gotchas worth remembering if the package structure changes:
- electron-vite's dev runner always expects `out/main/index.js` and `out/preload/index.js` — a custom Rollup `input` filename gets overridden back to `index.js` via `output.entryFileNames` in `electron.vite.config.ts`.
- `externalizeDepsPlugin` only reads the **local** `package.json` (`apps/desktop/package.json`) to decide what to leave un-bundled — a runtime dependency declared only in a workspace package (like `sql.js` in `packages/db`) has to also be listed in `apps/desktop/package.json`, or it gets bundled incorrectly and breaks at runtime.

**Packaging a real installer**: `npm run dist` (`electron-vite build` then `electron-builder --win`, config in `apps/desktop/package.json`'s `"build"` field) produces `apps/desktop/release/PakCyberbot-Life-Manager-Setup-<version>.exe` — a normal NSIS installer, unsigned (no code-signing cert — Windows SmartScreen will warn "unknown publisher"), Windows-only for now, no auto-update. Two things had to be fixed to get a packaged build that actually *runs* rather than just builds successfully (both only surfaced by launching the real output, not from the build logs): electron-builder needs `electronVersion` pinned explicitly in the config since the project's own `electron` dependency is a version range; and the window icon (`resources/icon.ico`) needed an `extraResources` entry + a packaged-path fallback in `main.ts` (`resolveIconPath()`) since its dev-mode relative path only resolves to a real file outside a packaged app's `asar` archive — the same two-path pattern `framework.md` already used. See CLAUDE.md's Packaging section for the full story.
