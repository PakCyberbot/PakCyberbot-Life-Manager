// Desktop (Electron main process) implementation of DataStore, backed by sql.js.
//
// Why sql.js instead of better-sqlite3: better-sqlite3 is a native module that
// has to be rebuilt against Electron's ABI (via node-gyp/MSBuild on Windows),
// and that toolchain is known to choke on paths containing spaces/apostrophes —
// exactly what this project's folder name has. sql.js is SQLite compiled to
// WebAssembly: zero native compilation, works identically regardless of path,
// and runs unmodified in a browser too (handy once a web app target exists).
//
// Trade-off: the whole DB lives in memory and is explicitly exported to disk
// after writes. Fine for a personal app's data volume; debounced + flushed on
// quit so we're not thrashing disk on every keystroke.

import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { SCHEMA_STATEMENTS } from './schema';
import type { DataStore } from './DataStore';
import { decryptSecret, encryptSecret, SECRET_SETTING_KEYS } from './secretCrypto';

const SAVE_DEBOUNCE_MS = 250;

// Seeded once, on first-ever launch only — two are yours, three are ours,
// none are attributed to a real person (safer than guessing/misattributing
// a famous "quote" that person never actually said).
const DEFAULT_QUOTES: string[] = [
  "Never waste time on entertainment that won't move your life forward.",
  "Someone else's story isn't yours to live.",
  'Discipline today is freedom tomorrow.',
  'A goal without a deadline is just a wish.',
  "You don't find time, you make it.",
];

function seedDefaultQuotes(db: Database) {
  const now = new Date().toISOString();
  for (const text of DEFAULT_QUOTES) {
    db.run('INSERT INTO quotes (id, text, author, createdAt, updatedAt, deletedAt) VALUES (?, ?, NULL, ?, ?, NULL)', [
      crypto.randomUUID(),
      text,
      now,
      now,
    ]);
  }
}

// One editable custom category (seeded with Cybersecurity, per the user's own
// example) plus three fixed built-ins. Country/city start with no
// locationValue set — News & Updates shows them as "set a location in
// Settings" until configured, rather than guessing one.
const DEFAULT_NEWS_CATEGORIES: { type: string; name: string; prompt: string | null }[] = [
  {
    type: 'custom',
    name: 'Cybersecurity',
    prompt: 'Latest news, techniques, threats, and updates in the field of cybersecurity.',
  },
  {
    type: 'global-politics',
    name: 'Global Politics',
    prompt: 'Major global political and policy developments that matter to people everywhere, not tied to one country.',
  },
  { type: 'country', name: 'Country News', prompt: null },
  { type: 'city', name: 'City News', prompt: null },
];

function seedDefaultNewsCategories(db: Database) {
  const now = new Date().toISOString();
  for (const cat of DEFAULT_NEWS_CATEGORIES) {
    db.run(
      'INSERT INTO newsCategories (id, type, name, prompt, locationValue, lastFetchedAt, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL)',
      [crypto.randomUUID(), cat.type, cat.name, cat.prompt, now, now]
    );
  }
}

// Exactly 7 rows, one per day-of-week (0=Sun..6=Sat) — seeded once and only
// ever updated from the UI afterward, never added to or removed from.
function seedDefaultDaySchedules(db: Database) {
  const now = new Date().toISOString();
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    db.run(
      'INSERT INTO daySchedules (id, dayOfWeek, wakeTime, sleepTime, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      [crypto.randomUUID(), dayOfWeek, '07:00', '23:00', now, now]
    );
  }
}

/** The desktop store adds a few methods beyond the generic DataStore shape:
 * - getSetting/setSetting: `settings` is keyed by `key`, not `id`, and
 *   transparently encrypts/decrypts anything in SECRET_SETTING_KEYS.
 * - replaceNewsItems: `newsItems` holds only the latest fetch per category
 *   (hard-deleted and reinserted on refresh) rather than an ever-growing
 *   history, so it doesn't go through the soft-delete generic `remove()`. */
export interface ElectronDataStore extends DataStore {
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  /** Forces an immediate synchronous write to disk, without closing the store — use before copying the DB file out. */
  flush(): void;
  /** Genuinely deletes the row (unlike `remove`, which only sets deletedAt). Used where soft-delete's "keep it around
   * for potential recovery" trade-off doesn't apply — e.g. Library books/videos, which can also carry a sizable
   * data: URI cover/thumbnail that shouldn't linger in the DB forever after the user explicitly deletes the item. */
  hardRemove(table: string, id: string): void;
  replaceNewsItems(
    categoryId: string,
    items: Array<{ id: string; title: string; summary: string | null; url: string; source: string | null; publishedAt: string | null }>
  ): void;
  replaceJobListings(
    searchId: string,
    items: Array<{
      id: string;
      title: string;
      company: string | null;
      location: string | null;
      url: string;
      source: string;
      tags: string | null;
      aiNote: string | null;
      postedAt: string | null;
    }>
  ): void;
}

export async function createElectronDataStore(dbFilePath: string): Promise<ElectronDataStore> {
  const SQL = await initSqlJs();

  const isFreshDb = !fs.existsSync(dbFilePath);
  const db: Database = isFreshDb ? new SQL.Database() : new SQL.Database(fs.readFileSync(dbFilePath));
  for (const statement of SCHEMA_STATEMENTS) db.run(statement);

  // Lightweight column migration: `CREATE TABLE IF NOT EXISTS` in SCHEMA_STATEMENTS
  // only affects fresh tables, so a column added to an *existing* table (e.g.
  // Exercise's videoUrl, added after exercises already shipped) needs an
  // explicit ALTER TABLE for anyone who already has that table on disk. No
  // formal migration system exists yet — this is the ad hoc equivalent,
  // idempotent via a PRAGMA table_info check first.
  function ensureColumn(table: string, column: string, definition: string) {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    const existing = new Set<string>();
    while (stmt.step()) {
      const row = stmt.getAsObject() as { name: string };
      existing.add(row.name);
    }
    stmt.free();
    if (!existing.has(column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  ensureColumn('exercises', 'videoUrl', 'TEXT');
  ensureColumn('exercises', 'videoThumbnail', 'TEXT');
  ensureColumn('entertainment', 'thumbnail', 'TEXT');

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function writeToDisk() {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(dbFilePath, Buffer.from(db.export()));
  }

  // Per-table emptiness check rather than isFreshDb alone: a table added in
  // a later app version (e.g. quotes/newsCategories, both added after this
  // project's DB already existed) would otherwise never get seeded for
  // anyone who installed before that version — isFreshDb is only true once,
  // on a device's very first launch ever.
  function tableIsEmpty(table: string): boolean {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
    stmt.step();
    const { count } = stmt.getAsObject() as { count: number };
    stmt.free();
    return count === 0;
  }

  if (tableIsEmpty('quotes')) seedDefaultQuotes(db);
  if (tableIsEmpty('newsCategories')) seedDefaultNewsCategories(db);
  if (tableIsEmpty('daySchedules')) seedDefaultDaySchedules(db);

  // Write the file immediately on first launch so it exists on disk right
  // away (useful for backups/discoverability), rather than only appearing
  // after the user's first create/update/remove.
  if (isFreshDb) writeToDisk();

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(writeToDisk, SAVE_DEBOUNCE_MS);
  }

  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    writeToDisk();
  }

  function queryAll<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = db.prepare(sql);
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  return {
    list<T>(table: string, where?: Record<string, unknown>): T[] {
      let sql = `SELECT * FROM ${table} WHERE deletedAt IS NULL`;
      const params: unknown[] = [];
      for (const [column, value] of Object.entries(where ?? {})) {
        sql += ` AND ${column} = ?`;
        params.push(value);
      }
      sql += ' ORDER BY createdAt DESC';
      return queryAll<T>(sql, params);
    },

    get<T>(table: string, id: string): T | null {
      return queryAll<T>(`SELECT * FROM ${table} WHERE id = ?`, [id])[0] ?? null;
    },

    create<T extends Record<string, unknown>>(table: string, row: T): T {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      db.run(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((c) => row[c] as never)
      );
      persist();
      return row;
    },

    update(table: string, id: string, patch: Record<string, unknown>): void {
      const columns = Object.keys(patch);
      if (columns.length === 0) return;
      const setClause = columns.map((c) => `${c} = ?`).join(', ');
      db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
        ...columns.map((c) => patch[c] as never),
        id as never,
      ]);
      persist();
    },

    remove(table: string, id: string): void {
      db.run(`UPDATE ${table} SET deletedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
      persist();
    },

    hardRemove(table: string, id: string): void {
      db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
      persist();
    },

    getSetting(key: string): string | null {
      const row = queryAll<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])[0];
      if (!row?.value) return row?.value ?? null;
      return SECRET_SETTING_KEYS.has(key) ? decryptSecret(row.value) : row.value;
    },

    setSetting(key: string, value: string): void {
      const stored = SECRET_SETTING_KEYS.has(key) && value ? encryptSecret(value) : value;
      db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        stored,
      ]);
      persist();
    },

    replaceNewsItems(categoryId, items): void {
      db.run('DELETE FROM newsItems WHERE categoryId = ?', [categoryId]);
      const now = new Date().toISOString();
      for (const item of items) {
        db.run(
          'INSERT INTO newsItems (id, categoryId, title, summary, url, source, publishedAt, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
          [item.id, categoryId, item.title, item.summary, item.url, item.source, item.publishedAt, now, now]
        );
      }
      persist();
    },

    replaceJobListings(searchId, items): void {
      db.run('DELETE FROM jobListings WHERE searchId = ?', [searchId]);
      const now = new Date().toISOString();
      for (const item of items) {
        db.run(
          'INSERT INTO jobListings (id, searchId, title, company, location, url, source, tags, aiNote, postedAt, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
          [item.id, searchId, item.title, item.company, item.location, item.url, item.source, item.tags, item.aiNote, item.postedAt, now, now]
        );
      }
      persist();
    },

    /** Forces an immediate synchronous write, without shutting the store down — use before copying the file out (export). */
    flush,

    close: flush,
  };
}
