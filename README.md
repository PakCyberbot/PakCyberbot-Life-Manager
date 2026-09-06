# PakCyberbot Life Manager

A local-first, cross-platform personal life management app — goals (with tasks, milestones, and auto-tracked progress built in), calendar, a weekly Time Table with a creative live rotating clock, personal savings + a wishlist, a book/video/web-link library (with an in-app PDF reader — on desktop *and* mobile — that tracks your bookmark automatically), life quotes, Google Drive sync (manual or fully automatic), an AI-powered News digest, Entertainment "worth it" verdicts, Earning Ways ideas/guides, a Jobs aggregator, a Health section, and an optional File Manager. Desktop-first (Electron), with a genuinely capable Android companion app (`apps/mobile`) sharing the same codebase — not just a read-only mirror.

**Status**: v1.1.1 — desktop is fully built out and the mobile companion has real editing (Goals, Library, Savings), its own in-app PDF reader, News refresh, and two-way Google Drive sync. Signed builds for both platforms are on the [Releases page](https://github.com/PakCyberbot/PakCyberbot-Life-Manager/releases).

## Features

- **Dashboard** — today's snapshot across every module, a rotating life-quote card, and Today's Time Table (list or clock view)
- **Goals & Targets** — fully editable title/description/category/type/target date, an auto-fetched cover image (from Wikipedia, by title), milestones (progress auto-computes from how many are checked off), and **Tasks live inside each goal** (not a separate section): break a goal into steps, nest them under a specific milestone if you like, and optionally link each one to a file/folder, a web URL, or a book/video from Library (title defaults to the linked item's own name if you leave it blank). A View/Edit toggle on each goal's detail keeps a clean read-only summary the default, switching to the full editor only when you need it
- **Calendar** — month view, event scheduling
- **Time Table** — your recurring weekly routine (distinct from Calendar's dated events): set wake/sleep time per day (or apply one time to several days at once), then fill the hours with time slots. Slots are editable and clonable to other days. Two clock views: a classic two-face AM/PM analog clock with each slot as a colored ring, or a **Live Rotating Clock** — one continuously-sweeping hand, a forward-looking brightness spotlight on what's coming up next, an "Up next" card stack, and a 12-hour/24-hour (military time) toggle
- **Savings** — your personal total (not full expense bookkeeping): log amounts added or spent, see the running total, and keep a wishlist of purchases/trips/subscriptions/investments you're saving toward — marking one "done" automatically logs the expense (and reverses it if you undo)
- **Library** — books (linked to a local PDF, opened in an in-app reader that tracks your bookmark automatically), videos (YouTube, auto-fetched thumbnail), and web links (any article/page URL, with an auto-fetched preview). Sync any book to your phone with one toggle — it uploads to your own Drive and shows up as a "Download" on mobile, where it opens in a real in-app reader with pinch-zoom, rotation, automatic landscape reflow, and an explicit "bookmark this page?" prompt instead of guessing from scroll position
- **News & Updates** — real, clickable articles from Google News RSS, ranked and summarized by your chosen AI provider. One fully custom category (seeded as Cybersecurity) plus Global Politics, Country, and City — add as many custom ones as you want, managed from a dedicated popup so the list can grow without stretching Settings. Plus **Blogs & Websites**: paste any blog/news site's URL and get a real, live, scrollable preview of that page in its own in-app window — not an AI summary, the actual site
- **Entertainment** — add a movie/show/game/anything and get a poster/thumbnail automatically (looked up from Wikipedia by title), plus an AI "worth your time" verdict (skills it builds, real benefits, time cost, addictiveness, mental effects) grounded in your own [framework.md](framework.md) criteria and a quick-edit criteria field in Settings — always advisory, never blocking
- **Earning Ways** — track income ideas manually, or get AI suggestions (grounded in your active Goals + framework.md); open any idea to get a full on-demand guide — steps, skills, tools, timeline, income potential, pitfalls, and named resources (never fabricated links)
- **Jobs** — real listings aggregated from free job sources (RemoteOK, Arbeitnow, We Work Remotely, Jobicy — never scraped from sites like LinkedIn/Indeed that prohibit it), ranked by your AI provider against searches you define in Settings (keywords + what to prioritize)
- **File Manager** — your own nested categories (e.g. Cybersecurity → Tools) linking to real folders/files on this machine. Links record which machine they were added from; visible everywhere, but only ever clickable to open on that same machine
- **Health** — exercise schedule (repeats weekly, like Time Table, with an optional reference video), doctor appointments (auto-sorted upcoming/past), food & nutrition (add a food with quantity/price, AI fills in benefits/calories/considerations moments later), and body metrics (a simple weight log with trend deltas)
- **Sections** — every module above (and this one) can be individually hidden from the sidebar via a switch in Settings. Nothing gets deleted, just hidden — flip it back on any time
- **Life Quotes** — a small curated set you manage from Settings, shown at random on the Dashboard
- **AI provider** — Gemini, OpenAI, or Anthropic, each via your own API key (no "subscription login" — see [structure.md](structure.md) for why that's not a real option for a third-party app); every credential is encrypted at rest. A "Check now" button in Settings (and a warning banner in the sidebar if something's wrong) shows whether the active provider is currently working or has hit its usage limit
- **Google Drive sync** — push/pull your data to your own Drive on demand, or turn on **Auto Sync** and never think about it: pushes automatically a few seconds after any change, and pulls automatically on startup whenever Drive actually has something newer (never on every launch unconditionally)
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

`npm run dist` produces `apps/desktop/release/PakCyberbot-Life-Manager-Setup-<version>.exe` — a normal NSIS installer (lets you pick the install location, adds a Start Menu shortcut). It's currently Windows-only and **unsigned** — there's no code-signing certificate for this project, so Windows SmartScreen will show an "unknown publisher" warning on first run; click "More info" → "Run anyway" to proceed. There's no auto-update wired up yet, so a new version means downloading and re-running the installer (or grabbing the latest one from [Releases](https://github.com/PakCyberbot/PakCyberbot-Life-Manager/releases)). See CLAUDE.md's "Cutting a release" section for the exact commands, including the signed Android APK build.

### Google Drive sync setup

Sync is built in but needs your own free Google OAuth credential — there's no way around this, it requires your own Google login:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project
2. **APIs & Services → Library** → enable "Google Drive API"
3. **APIs & Services → OAuth consent screen** → External → fill in the basics → add yourself as a test user
4. Still on the consent screen: **Edit app → Scopes → Add or remove scopes** → add `https://www.googleapis.com/auth/drive.file` (plus `openid`/`.../auth/userinfo.email` if not already listed) → save. **Don't skip this** — requesting the scope in the app itself isn't enough; Google only grants a scope that's also registered here, and silently drops anything else. Skipping it surfaces later as `403 insufficient authentication scopes` on your first Push.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Desktop app** (not "Web application" — that type needs a fixed, pre-registered redirect URI, and this app's redirect port changes every time)
6. Paste the resulting Client ID + Secret into the app's Settings → Google Drive sync → Connect. Expect an "unverified app" browser warning — click **Advanced → Go to [app name] (unsafe)**, which is normal for a personal, unpublished app
7. If you add the `drive.file` scope *after* already connecting once, click **Disconnect** then **Connect** again — an existing token can't gain a new scope just by refreshing it
8. Once connected, flip on **Auto Sync** in the same card if you'd rather it just happen in the background. The same Client ID/Secret work on mobile too — paste them again in the phone's Settings to connect there.

## Mobile companion (Android)

Started as a read-mostly companion for quick glances on the go, but it's grown a real editing surface of its own — still not a port of the desktop UI (a different, touch-first layout throughout), but no longer just a mirror either.

**Editable on mobile**: Goals (full per-goal task list, a Quick Tasks section for anything with no goal yet), Library (add/edit/delete books/videos/web links, all gated behind an "Edit" toggle so a stray tap can't misfire into a delete), and Savings (log entries, manage the wishlist). Books synced from desktop's "Sync to mobile" toggle download with one tap and open in a real in-app PDF reader — pinch-zoom, page rotation, automatic reflow when you turn the phone to landscape, and an explicit "bookmark this page?" prompt rather than guessing from scroll position. News & Updates can refresh itself from the phone too.

**View-only**: Calendar, Entertainment, Earning Ways, Jobs, and Health — mobile never runs its own AI or job-aggregation calls, only displays whatever the synced database already has. File Manager doesn't exist on mobile at all (it's a desktop-local-filesystem concept with no equivalent).

**Also built in**: two-way Google Drive sync (including Auto Sync, same as desktop), Android share-intent capture (share a YouTube link or article straight into Library from any other app), weekly local notifications for Time Table slots, a local backup (export/import the same raw `.sqlite` format desktop uses — a file moves freely between the two), and a working hardware/gesture back button throughout the app.

```sh
npm install                 # covers apps/mobile too (same npm workspaces)
npm run mobile:dev          # fast UI iteration in a browser (window.api isn't wired — for layout/styling only)
cd apps/mobile && npx cap add android   # one-time: generates the native Android project
npm run mobile:run          # builds, syncs into the native project, and launches on a connected device/emulator
```

Needs Android Studio + SDK + a JDK installed and an emulator (or device) running. See CLAUDE.md's "Mobile app" section for the full architecture writeup, the signed-release build steps, and known local-environment Gradle/JDK gotchas.

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
- [framework.md](framework.md) — the personal life-management methodology/values this app is built to serve (some AI features actually read from it at runtime)
- [CLAUDE.md](CLAUDE.md) — orientation notes for AI coding assistants working in this repo, including the full release-cutting checklist

## Roadmap

**v2**: a dedicated Habit Tracker (daily/weekly streaks, linkable to Goals) and Asset Management (devices/hardware inventory, warranty tracking) — everything else originally scoped for v2 has shipped (Entertainment, Earning Ways, Jobs, Health, File Manager, News & Updates, Library Web Links; Shopping/Wishlist is largely covered by Savings' own wishlist already).

**v3**: Journal, Contacts, Documents Vault, Net Worth charting, Subscriptions tracker, a broader AI Assistant (quick-add parsing, framework suggestions), and a web/PWA deploy of the same `packages/ui`/`packages/core`.

Full detail on all of these lives in [structure.md §5](structure.md).

## Tech stack

Electron · Capacitor (Android) · React · TypeScript · Vite · Tailwind CSS · Zustand · sql.js — see [structure.md §6](structure.md) for the reasoning behind each choice.
