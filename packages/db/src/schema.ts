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
  // Earning Ways — the guide* fields are generated on demand the first time
  // the detail view opens for a row (not eagerly on create, unlike
  // Entertainment's verdict), then cached here until "Regenerate" is used.
  // Multi-item fields (steps, pitfalls, resources) are newline-separated
  // plain text rather than JSON, consistent with the rest of this schema.
  `CREATE TABLE IF NOT EXISTS earningWays (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'idea',
    source TEXT NOT NULL DEFAULT 'user',
    notes TEXT,
    guideOverview TEXT,
    guideSteps TEXT,
    guideSkillsNeeded TEXT,
    guideTools TEXT,
    guideTimeline TEXT,
    guideIncomePotential TEXT,
    guidePitfalls TEXT,
    guideResources TEXT,
    guideGeneratedAt TEXT,
    guideProvider TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Jobs — saved searches (keywords + an AI framing prompt for what to
  // prioritize). jobListings holds only the latest fetch per search
  // (hard-deleted/reinserted, same live-digest pattern as newsItems), sourced
  // from real job APIs/feeds — never AI-generated, see ai/jobs.ts.
  `CREATE TABLE IF NOT EXISTS jobSearches (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    keywords TEXT NOT NULL,
    prompt TEXT,
    lastFetchedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS jobListings (
    id TEXT PRIMARY KEY,
    searchId TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    tags TEXT,
    aiNote TEXT,
    postedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // File Manager (optional, enabled from Settings) — a self-referencing
  // category tree (parentId) for organizing links to real folders/files on
  // disk. Each link records the hostname it was added from; opening one is
  // only ever attempted when that matches the current machine — see
  // structure.md for why (this is not a synced file store, just organized
  // shortcuts, and a path from another machine may not exist here at all).
  `CREATE TABLE IF NOT EXISTS fileCategories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parentId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS fileLinks (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    label TEXT NOT NULL,
    path TEXT NOT NULL,
    isFolder INTEGER NOT NULL DEFAULT 1,
    hostname TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Time Table — a recurring *weekly* routine, distinct from Calendar's
  // date-specific events. One daySchedules row per day-of-week (0=Sun..6=Sat,
  // always exactly 7, seeded once and only ever updated, never added/removed)
  // holds that day's wake/sleep time; timeSlots hold what to do within it,
  // also keyed by dayOfWeek so they repeat every week rather than being tied
  // to one date.
  `CREATE TABLE IF NOT EXISTS daySchedules (
    id TEXT PRIMARY KEY,
    dayOfWeek INTEGER NOT NULL,
    wakeTime TEXT NOT NULL DEFAULT '07:00',
    sleepTime TEXT NOT NULL DEFAULT '23:00',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS timeSlots (
    id TEXT PRIMARY KEY,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    label TEXT NOT NULL,
    notes TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  // Health — four sub-areas sharing one screen (tabs), one store, and this
  // one schema comment. exercises repeat weekly like Time Table (daysOfWeek,
  // not a date); doctorAppointments are date-specific; foods get AI-generated
  // benefits/calories/considerations shortly after being added, same
  // async-enrichment pattern as Entertainment; bodyMetrics is a simple
  // dated weight log for a trend view.
  `CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'strength',
    daysOfWeek TEXT NOT NULL DEFAULT '',
    durationMinutes INTEGER,
    sets INTEGER,
    reps INTEGER,
    notes TEXT,
    videoUrl TEXT,
    videoThumbnail TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS doctorAppointments (
    id TEXT PRIMARY KEY,
    doctorName TEXT NOT NULL,
    specialty TEXT,
    appointmentAt TEXT NOT NULL,
    reason TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    price REAL,
    benefits TEXT,
    caloriesEstimate TEXT,
    considerations TEXT,
    aiGeneratedAt TEXT,
    aiProvider TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bodyMetrics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
];
