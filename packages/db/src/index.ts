// Deliberately NOT re-exporting electronDriver.ts or capacitorDriver.ts here:
// each pulls in platform-specific dependencies (sql.js + node:fs/node:path for
// the former, @capacitor-community/sqlite for the latter) that the *other*
// app target doesn't have installed. Bundling either transitively into the
// wrong app would break that app's build even if the code path is never
// called at runtime. Each app imports its own concrete driver directly:
// apps/desktop from '@life-manager/db/src/electronDriver',
// apps/mobile from '@life-manager/db/src/capacitorDriver'.
export * from './DataStore';
export * from './schema';
