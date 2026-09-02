# PakCyberbot Life Manager

A local-first, cross-platform personal life management app — goals (with tasks built in), calendar, personal savings, a book/video/web-link library, and life quotes, all in one place. Desktop-first (Electron), with an Android companion app in progress via the same shared codebase.

**Status**: v0.2.0 — every module below is built for desktop, a Windows installer is available (see Releases), and Google Drive sync has been verified end-to-end. A read-mostly Android companion app (`apps/mobile`) is under active development — see [Mobile companion](#mobile-companion-android-in-progress) below.

## Features

- **Dashboard** — today's snapshot across every module, a rotating life-quote card, and Today's Time Table
- **Goals & Targets** — fully editable title/description/category/type/target date, milestones (progress auto-computes from how many are checked off once you add any), and **Tasks live inside each goal now** (not a separate section): break a goal into steps, each editable after creation and optionally linked to a file/folder, a web URL, or a book/video from Library (linking tags that book/video with the goal's name, and jumps straight to it in Library when clicked)
- **Calendar** — month view, event scheduling
- **Time Table** — your recurring weekly routine (distinct from Calendar's dated events): set wake/sleep time per day (or apply one time to several days at once), then fill the hours with time slots — what to do, when, every week. Slots are editable and clonable to other days, and a Clock view shows your day as two AM/PM analog clock faces with each slot as a colored ring (sleep dimmed low-opacity) alongside the plain list
- **Savings** — your personal total (not full expense bookkeeping): log amounts added or spent, see the running total, and keep a wishlist of purchases, trips, subscriptions, or investment plans you're saving toward
- **Library** — books (linked to a local PDF, with an in-app reader that tracks your bookmark automatically), videos (YouTube, auto-fetched thumbnail), and web links (any article/page URL to explore later, with an auto-fetched preview thumbnail); a host filter appears once books exist on more than one machine, and a goal-name badge shows on anything linked from a Task
- **News & Updates** — real, clickable articles from Google News RSS, ranked and summarized by your chosen AI provider. One fully custom category (seeded as Cybersecurity) plus Global Politics, Country, and City — add as many custom ones as you want. Plus **Blogs & Websites**: paste any blog/news site's URL and get a real, live, scrollable preview of that page in its own in-app window — not an AI summary, the actual site
- **Entertainment** — add a movie/show/game/anything and get a poster/thumbnail automatically (looked up from Wikipedia by title — paste your own image URL only if you want to override it), plus an AI "worth your time" verdict (skills it builds, real benefits, time cost, addictiveness, mental effects) grounded in your own [framework.md](framework.md) criteria and a quick-edit criteria field in Settings — always advisory, never blocking
- **Earning Ways** — track income ideas manually, or get AI suggestions (grounded in your active Goals + framework.md); open any idea to get a full on-demand guide — steps, skills, tools, timeline, income potential, pitfalls, and named resources (never fabricated links)
- **Jobs** — real listings aggregated from free job sources (RemoteOK, Arbeitnow, We Work Remotely, Jobicy — never scraped from sites like LinkedIn/Indeed that prohibit it), ranked by your AI provider against searches you define in Settings (keywords + what to prioritize)
- **File Manager** — your own nested categories (e.g. Cybersecurity → Tools) linking to real folders/files on this machine. Links record which machine they were added from; visible everywhere, but only ever clickable to open on that same machine
- **Health** — exercise schedule (repeats weekly, like Time Table, with an optional reference video), doctor appointments (auto-sorted upcoming/past), food & nutrition (add a food with quantity/price, AI fills in benefits/calories/considerations moments later), and body metrics (a simple weight log with trend deltas)
- **Sections** — every module above (and this one) can be individually hidden from the sidebar via a switch in Settings. Nothing gets deleted, just hidden — flip it back on any time
- **Life Quotes** — a small curated set you manage from Settings, shown at random on the Dashboard
- **AI provider** — Gemini, OpenAI, or Anthropic, each via your own API key (no "subscription login" — see [structure.md](structure.md) for why that's not a real option for a third-party app); every credential is encrypted at rest. A "Check now" button in Settings (and a warning banner in the sidebar if something's wrong) shows whether the active provider is currently working or has hit its usage limit — no provider exposes a real "remaining credits" number, so this checks live rather than showing a made-up figure
- **Google Drive sync** — push/pull your data to your own Drive (needs a one-time free Google credential, see Setup below)
- **Local backup** — export/import the database as a plain file, no Google account needed, from Settings
- Light / dark / system theme, opens maximized by default; date/time fields open their calendar/clock picker on a click anywhere in the field

## Getting started

Prerequisites: Node.js 18+ and npm.

```sh
npm install
npm run dev
```

That starts the Electron app with hot reload for the UI. Main-process changes (anything under `apps/desktop/electron/`) need the command restarted.

Other useful commands (see [CLAUDE.md](CLAUDE.md) for the full list and known gotchas):

```sh
npm run typecheck   # TypeScript across the whole workspace
npm run build       # electron-vite production build (out/ folder, not an installer)
npm run dist        # builds a real Windows installer — see below
```

### Building a Windows installer

`npm run dist` produces `apps/desktop/release/PakCyberbot-Life-Manager-Setup-<version>.exe` — a normal NSIS installer (lets you pick the install location, adds a Start Menu shortcut). It's currently Windows-only and **unsigned** — there's no code-signing certificate for this project, so Windows SmartScreen will show an "unknown publisher" warning on first run; click "More info" → "Run anyway" to proceed. There's no auto-update wired up yet, so a new version means downloading and re-running the installer.

### Google Drive sync setup

Sync is built in but needs your own free Google OAuth credential — there's no way around this, it requires your own Google login:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project
2. **APIs & Services → Library** → enable "Google Drive API"
3. **APIs & Services → OAuth consent screen** → External → fill in the basics → add yourself as a test user
4. Still on the consent screen: **Edit app → Scopes → Add or remove scopes** → add `https://www.googleapis.com/auth/drive.file` (plus `openid`/`.../auth/userinfo.email` if not already listed) → save. **Don't skip this** — requesting the scope in the app itself isn't enough; Google only grants a scope that's also registered here, and silently drops anything else. Skipping it surfaces later as `403 insufficient authentication scopes` on your first Push.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Desktop app** (not "Web application" — that type needs a fixed, pre-registered redirect URI, and this app's redirect port changes every time)
6. Paste the resulting Client ID + Secret into the app's Settings → Google Drive sync → Connect. Expect an "unverified app" browser warning — click **Advanced → Go to [app name] (unsafe)**, which is normal for a personal, unpublished app
7. If you add the `drive.file` scope *after* already connecting once, click **Disconnect** then **Connect** again — an existing token can't gain a new scope just by refreshing it

## Mobile companion (Android, in progress)

A read-mostly companion for quick glances on the go — not a port of the desktop UI. Dashboard shows the same goals/events/savings/quotes as desktop plus today's Time Table as a Clock view; every other module is view-only; **Library** (books/videos/web links) is the one editable section, for quickly saving something to look at later.

**Phase 1 (done)**: its own local data (a real on-device SQLite database, same schema as desktop), a full read-only UI for every module, an editable Library with manual add, weekly local notifications when a Time Table slot starts (toggle in Settings), and a local backup (export/import as a file — a different format from desktop's, since there's no reliable way to read the native SQLite plugin's file path on mobile). **Phase 2 (not started)**: Android share-intent capture (share a link straight into Library from any app) and Drive sync from the phone.

```sh
npm install                 # covers apps/mobile too (same npm workspaces)
npm run mobile:dev          # fast UI iteration in a browser (window.api isn't wired — for layout/styling only)
cd apps/mobile && npx cap add android   # one-time: generates the native Android project
npm run mobile:run          # builds, syncs into the native project, and launches on a connected device/emulator
```

Needs Android Studio + SDK + a JDK installed and an emulator (or device) running. See CLAUDE.md's "Mobile app" section for the full architecture writeup and known local-environment Gradle/JDK gotchas.

## Project structure

An npm-workspaces monorepo — see [structure.md](structure.md) for the full architecture writeup.

```
apps/desktop/     Electron shell (main, preload, Drive sync, Vite renderer entry)
apps/mobile/      Capacitor/Android companion — its own UI + mobile api layer (see above)
packages/shared/  Types + utils, no dependencies
packages/db/      SQLite schema + the DataStore abstraction (sql.js on desktop, @capacitor-community/sqlite on mobile)
packages/core/    Zustand stores, one per module — shared unmodified by both apps
packages/ui/      Desktop's React screens/components, plus a few platform-neutral pieces mobile reuses
```

## Documentation

- [structure.md](structure.md) — technical architecture, module roadmap, data models
- [framework.md](framework.md) — the personal life-management methodology/values this app is built to serve (some planned AI features read from it)
- [CLAUDE.md](CLAUDE.md) — orientation notes for AI coding assistants working in this repo

## Roadmap

**v2**: Skills & Earning, Habit Tracker, Asset Management, Shopping/Wishlist.

**v3**: Journal, Contacts, Documents Vault, Net Worth charting, Subscriptions tracker, a broader AI Assistant (quick-add parsing, framework suggestions), and web/mobile targets via Capacitor reusing the same `packages/ui`/`packages/core`.

Full detail on all of these lives in [structure.md §5](structure.md).

## Tech stack

Electron · React · TypeScript · Vite · Tailwind CSS · Zustand · sql.js — see [structure.md §6](structure.md) for the reasoning behind each choice.
