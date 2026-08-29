# PakCyberbot Life Manager

A local-first, cross-platform personal life management app — goals, calendar, tasks, money, a book/video library, and life quotes, all in one place. Desktop-first (Electron), with mobile/web planned via the same shared codebase.

**Status**: v1 desktop build, actively developed.

## Features

- **Dashboard** — today's snapshot across every module, plus a rotating life-quote card
- **Goals & Targets** — progress tracking, milestones
- **Calendar** — month view, event scheduling
- **Tasks** — a 3-column to-do board
- **Money** — accounts, transactions, budgets vs. spend
- **Library** — books (linked to a local PDF, with an in-app reader that tracks your bookmark automatically) and videos (YouTube, auto-fetched thumbnail)
- **Life Quotes** — a small curated set you manage from Settings, shown at random on the Dashboard
- **Google Drive sync** — push/pull your data to your own Drive (needs a one-time free Google credential, see Setup below)
- Light / dark / system theme

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

**v2**: Skills & Earning, Earning Ways (with AI-generated guides), Habit Tracker, Asset Management, Shopping/Wishlist, Entertainment tracking with an AI "worth it" verdict.

**v3**: Journal, Contacts, Documents Vault, Net Worth charting, Subscriptions tracker, a Gemini-powered AI Assistant, and web/mobile targets via Capacitor reusing the same `packages/ui`/`packages/core`.

Full detail on all of these lives in [structure.md §5](structure.md).

## Tech stack

Electron · React · TypeScript · Vite · Tailwind CSS · Zustand · sql.js — see [structure.md §6](structure.md) for the reasoning behind each choice.
