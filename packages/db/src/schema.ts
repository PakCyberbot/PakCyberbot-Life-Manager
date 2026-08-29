// SQLite schema for all v1 (+ a few forward-looking) tables.
// Column names match the TypeScript field names in @life-manager/shared exactly,
// so rows read back via `getAsObject()` need no camelCase<->snake_case mapping.
//
// Every table carries createdAt/updatedAt/deletedAt (soft delete) per structure.md §8,
// even where v1 doesn't use all of them yet — cheap now, avoids a migration later.

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    type TEXT NOT NULL DEFAULT 'short-term',
    targetDate TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    progressPct INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    goalId TEXT NOT NULL,
    title TEXT NOT NULL,
    dueDate TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    dueDate TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'todo',
    linkedGoalId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    startAt TEXT NOT NULL,
    endAt TEXT,
    allDay INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT 'blue',
    linkedGoalId TEXT,
    linkedTaskId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash',
    currency TEXT NOT NULL DEFAULT 'USD',
    startingBalance REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    category TEXT,
    date TEXT NOT NULL,
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    monthlyLimit REAL NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Generic cross-module linking table (structure.md's "linking/tags" system).
  // Not surfaced in the v1 UI yet, but the table exists so nothing needs
  // migrating when a later module starts writing to it.
  `CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    linkedType TEXT NOT NULL,
    linkedId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  // Simple key-value store for app-level settings that need to persist
  // (reader executable path, etc.) — theme lives in renderer localStorage
  // since it's per-device by nature, but reader config should sync with
  // everything else once Drive sync lands, hence it lives in the DB.
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  // Library — books tracked by a local file path. hostname records which
  // machine the path was added from, since a synced book list won't
  // necessarily have the file physically present on every machine.
  `CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filePath TEXT,
    hostname TEXT,
    coverImage TEXT,
    bookmarkPage INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'to-read',
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Library — videos/playlists tracked by URL (YouTube etc.), with a
  // locally-cached thumbnail so nothing needs a live network call to render.
  `CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'video',
    thumbnail TEXT,
    status TEXT NOT NULL DEFAULT 'to-watch',
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Life Quotes / Reminders (structure.md's Dashboard widget). Managed from
  // Settings; the Dashboard shows one at random each time it's viewed.
  `CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // News & Updates categories. 'custom' has an editable name+prompt (e.g. the
  // seeded "Cybersecurity" one); 'global-politics'/'country'/'city' are fixed
  // built-ins — country/city need a locationValue set before they'll fetch.
  `CREATE TABLE IF NOT EXISTS newsCategories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT,
    locationValue TEXT,
    lastFetchedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Holds only the *latest* fetch per category (replaced wholesale on
  // refresh, see ElectronDataStore.replaceNewsItems) — this is a live digest,
  // not an archive, so there's no unbounded growth to worry about.
  `CREATE TABLE IF NOT EXISTS newsItems (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    source TEXT,
    publishedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Entertainment / Leisure — the "worth your time" verdict fields are filled
  // in by the AI shortly after a row is created (async, non-blocking — the
  // card shows up immediately, verdict fields populate a moment later), and
  // are always advisory: userNotes lets the user record their own take
  // regardless of what the AI said.
  `CREATE TABLE IF NOT EXISTS entertainment (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'considering',
    verdict TEXT,
    reasoning TEXT,
    skillsImproved TEXT,
    benefits TEXT,
    timeCostEstimate TEXT,
    addictiveness TEXT,
    mentalEffects TEXT,
    aiGeneratedAt TEXT,
    aiProvider TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
];
