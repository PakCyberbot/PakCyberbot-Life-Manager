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

/** The desktop store adds a plain key-value settings accessor, since the
 * `settings` table is keyed by `key` rather than `id` and doesn't fit the
 * generic list/get/create/update/remove shape the other tables use. */
export interface ElectronDataStore extends DataStore {
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
}

export async function createElectronDataStore(dbFilePath: string): Promise<ElectronDataStore> {
  const SQL = await initSqlJs();

  const isFreshDb = !fs.existsSync(dbFilePath);
  const db: Database = isFreshDb ? new SQL.Database() : new SQL.Database(fs.readFileSync(dbFilePath));
  for (const statement of SCHEMA_STATEMENTS) db.run(statement);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function writeToDisk() {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(dbFilePath, Buffer.from(db.export()));
  }

  if (isFreshDb) seedDefaultQuotes(db);

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

    getSetting(key: string): string | null {
      const row = queryAll<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])[0];
      return row?.value ?? null;
    },

    setSetting(key: string, value: string): void {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        value,
      ]);
      persist();
    },

    close: flush,
  };
}
