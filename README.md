# PakCyberbot Life Manager

A local-first, cross-platform personal life management app — goals (with tasks built in), calendar, personal savings, a book/video library, and life quotes, all in one place. Desktop-first (Electron), with mobile/web planned via the same shared codebase.

**Status**: v1 desktop build, actively developed.

## Features

- **Dashboard** — today's snapshot across every module, a rotating life-quote card, and Today's Time Table
- **Goals & Targets** — progress tracking, milestones, and **Tasks live inside each goal now** (not a separate section): break a goal into steps, each optionally linked to a file/folder on this machine, or a book/video from Library (linking tags that book/video with the goal's name, and jumps straight to it in Library when clicked)
- **Calendar** — month view, event scheduling
- **Time Table** — your recurring weekly routine (distinct from Calendar's dated events): set wake/sleep time per day (or apply one time to several days at once), then fill the hours with time slots — what to do, when, every week
- **Savings** — your personal total (not full expense bookkeeping): log amounts added or spent, see the running total, and keep a wishlist of purchases, trips, subscriptions, or investment plans you're saving toward
- **Library** — books (linked to a local PDF, with an in-app reader that tracks your bookmark automatically) and videos (YouTube, auto-fetched thumbnail); a host filter appears once books exist on more than one machine, and a goal-name badge shows on anything linked from a Task
- **News & Updates** — real, clickable articles from Google News RSS, ranked and summarized by your chosen AI provider. One fully custom category (seeded as Cybersecurity) plus Global Politics, Country, and City — add as many custom ones as you want
- **Entertainment** — add a movie/show/game/anything (with an optional poster/thumbnail image), get an AI "worth your time" verdict (skills it builds, real benefits, time cost, addictiveness, mental effects) grounded in your own [framework.md](framework.md) criteria and a quick-edit criteria field in Settings — always advisory, never blocking
- **Earning Ways** — track income ideas manually, or get AI suggestions (grounded in your active Goals + framework.md); open any idea to get a full on-demand guide — steps, skills, tools, timeline, income potential, pitfalls, and named resources (never fabricated links)
- **Jobs** — real listings aggregated from free job sources (RemoteOK, Arbeitnow, We Work Remotely, Jobicy — never scraped from sites like LinkedIn/Indeed that prohibit it), ranked by your AI provider against searches you define in Settings (keywords + what to prioritize)
- **File Manager** — your own nested categories (e.g. Cybersecurity → Tools) linking to real folders/files on this machine. Links record which machine they were added from; visible everywhere, but only ever clickable to open on that same machine
- **Health** — exercise schedule (repeats weekly, like Time Table, with an optional reference video), doctor appointments (auto-sorted upcoming/past), food & nutrition (add a food with quantity/price, AI fills in benefits/calories/considerations moments later), and body metrics (a simple weight log with trend deltas)
- **Sections** — every module above (and this one) can be individually hidden from the sidebar via a switch in Settings. Nothing gets deleted, just hidden — flip it back on any time
- **Life Quotes** — a small curated set you manage from Settings, shown at random on the Dashboard
- **AI provider** — Gemini, OpenAI, or Anthropic, each via your own API key (no "subscription login" — see [structure.md](structure.md) for why that's not a real option for a third-party app); every credential is encrypted at rest
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
npm run build       # electron-vite production build (no installer yet)
```

### Google Drive sync setup

Sync is built in but needs your own free Google OAuth credential — there's no way around this, it requires your own Google login:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project
2. **APIs & Services → Library** → enable "Google Drive API"
3. **APIs & Services → OAuth consent screen** → External → fill in the basics → add yourself as a test user
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Desktop app**
5. Paste the resulting Client ID + Secret into the app's Settings → Google Drive sync → Connect

## Project structure

An npm-workspaces monorepo — see [structure.md](structure.md) for the full architecture writeup.

```
apps/desktop/     Electron shell (main, preload, Drive sync, Vite renderer entry)
packages/shared/  Types + utils, no dependencies
packages/db/      SQLite schema + the DataStore abstraction (sql.js-backed on desktop)
packages/core/    Zustand stores, one per module
packages/ui/      All React screens/components — platform-agnostic
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
