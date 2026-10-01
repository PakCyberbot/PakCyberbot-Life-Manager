// Mobile (Capacitor/Android) implementation of DataStore, backed by
// @capacitor-community/sqlite's native SQLite binding — the seam both
// DataStore.ts's and api.ts's top-of-file comments already anticipated.
//
// Reuses SCHEMA_STATEMENTS from schema.ts verbatim (same tables, same column
// names) so the exact same sqlite file format round-trips through Drive sync
// between desktop and mobile — this driver is a different way of reading/
// writing the same schema, not a different schema.

import { Filesystem } from '@capacitor/filesystem';
import { SQLiteConnection, CapacitorSQLite, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SCHEMA_STATEMENTS } from './schema';
import { decryptSecretWeb, encryptSecretWeb, SECRET_SETTING_KEYS_WEB } from './secretCryptoWeb';

const DB_NAME = 'life-manager';

// Same seed data as electronDriver.ts — kept in sync manually since this file
// can't share code across a Node-vs-WebView boundary that cleanly.
const DEFAULT_QUOTES: string[] = [
  "Never waste time on entertainment that won't move your life forward.",
  "Someone else's story isn't yours to live.",
  'Discipline today is freedom tomorrow.',
  'A goal without a deadline is just a wish.',
  "You don't find time, you make it.",
];

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

function uuid(): string {
  return crypto.randomUUID();
}

// The base DataStore interface (list/get/create/update/remove/close) is
// synchronous, matching sql.js's in-memory API — @capacitor-community/sqlite
// is inherently async (a real native call per operation), so this driver's
// shape is deliberately its own async interface rather than DataStore
// itself, mirroring ElectronDataStore's extra methods (minus flush/replaceX,
// which mobile doesn't need in Phase 1 — it never fetches News/Jobs itself)
// but with every method returning a Promise. Written out explicitly (not
// derived from DataStore via a mapped type) so each generic method's type
// parameter is preserved — a mapped type over a generic method collapses its
// type parameter to `unknown`, which broke callers like apps/mobile's
// mobileApi.ts (`store.list<T>(...)` returning `Promise<unknown[]>`).
export interface MobileDataStore {
  list<T>(table: string, where?: Record<string, unknown>): Promise<T[]>;
  get<T>(table: string, id: string): Promise<T | null>;
  create<T extends Record<string, unknown>>(table: string, row: T): Promise<T>;
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: string, id: string): Promise<void>;
  hardRemove(table: string, id: string): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  /** The real on-device path of the native SQLite file (via SQLiteDBConnection.getUrl()) — the exact same
   * raw .sqlite format desktop's electronDriver.ts produces/consumes (this connection is opened with
   * 'no-encryption', so it's a plain unencrypted SQLite3 file), used for both local backup and Drive
   * push/pull so a file moves freely between the two apps. Empty string if it couldn't be resolved. */
  getDatabaseFilePath(): Promise<string>;
  /** Closes the live connection and overwrites the database file with new raw bytes (base64) — used when
   * the new bytes arrive as in-memory data (e.g. a picked file's content) rather than another file already
   * on disk (Drive's pull instead downloads straight to getDatabaseFilePath(), skipping this). The caller
   * reloads the app afterward; a fresh createCapacitorDataStore() call opens a new connection against the
   * freshly-written file, no explicit reopen needed here. */
  importRawDatabase(base64: string): Promise<void>;
  /** Merges any pages sitting in the native WAL sidecar file back into the main database file,
   * without closing the connection — call this right before reading the raw file bytes off disk
   * for any reason (Drive push uploads getDatabaseFilePath() directly while the connection stays
   * open, unlike pull/import). Without it, a push could silently upload a main file missing
   * whatever was last written but not yet checkpointed, since this driver's native connection
   * defaults to WAL journal mode. Best-effort — a failure here isn't fatal to the caller. */
  checkpoint(): Promise<void>;
  close(): Promise<void>;
}

export async function createCapacitorDataStore(): Promise<MobileDataStore> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  const consistency = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  const db: SQLiteDBConnection =
    consistency.result && isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

  // A genuinely corrupted on-disk file used to throw here and propagate all the way up to
  // main.tsx's bootstrap() with nothing catching it — the app just sat on its "Loading your
  // data…" splash forever. Confirmed happening for real: a device that hit the since-fixed Auto
  // Sync infinite-pull-loop bug (see driveSync's own notes) reloaded repeatedly mid pull(), and a
  // reload interrupting an in-flight FileTransfer.downloadFile writing straight over this same
  // file left a truncated/malformed sqlite database behind — Android's own SQLite layer then
  // fails on the very first `PRAGMA journal_mode` it runs against the file, before this driver
  // ever gets a chance to run its own schema/migration statements.
  //
  // Best-effort self-heal: retry once against a freshly deleted file. This does NOT reliably work
  // for this exact failure mode — confirmed by reading the plugin's own Android source
  // (Database.java's deleteDB() tries to open() the file first, purely to close it cleanly,
  // before removing it, so it throws the identical corruption error instead of ever deleting
  // anything — there is no lower-level "just unlink the bytes" call exposed to JS.  It's still
  // attempted here (cheap, and it does help a milder corruption where open() partially succeeds),
  // but a second failure is expected and must never be swallowed: it propagates as a real,
  // typed error so main.tsx can show the user something actionable instead of hanging silently a
  // second time. There is no way to recover the corrupted bytes themselves — if this device ever
  // pushed to Drive before going bad, that copy is untouched (a push only ever uploads from a
  // database that was actually open and working at the time), so reconnecting Drive and Pulling
  // in Settings is the real way back, not anything this function can do on its own.
  try {
    await db.open();
  } catch (openError) {
    console.warn('[capacitorDriver] db.open() failed — attempting to discard and recreate the database:', openError);
    try {
      await db.delete();
      await db.open();
    } catch (recoveryError) {
      throw new Error(
        `Could not open the local database — it appears to be corrupted and could not be automatically repaired (${String(recoveryError)}).`
      );
    }
  }

  // Cached once, right after opening — needed by importRawDatabase (below) and by anything reading the
  // path post-close (Drive pull, via getDatabaseFilePath()), since a closed/reopening connection can't be
  // relied on to answer getUrl() consistently mid-operation.
  const dbFilePath = (await db.getUrl()).url ?? '';

  for (const statement of SCHEMA_STATEMENTS) await db.execute(statement);

  // Same ad hoc column-migration helper as electronDriver.ts, same PRAGMA
  // table_info approach — just against the native plugin's query() method.
  async function ensureColumn(table: string, column: string, definition: string) {
    const info = await db.query(`PRAGMA table_info(${table})`);
    const existing = new Set((info.values ?? []).map((row) => row.name as string));
    if (!existing.has(column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  await ensureColumn('exercises', 'videoUrl', 'TEXT');
  await ensureColumn('exercises', 'videoThumbnail', 'TEXT');
  await ensureColumn('entertainment', 'thumbnail', 'TEXT');
  await ensureColumn('tasks', 'linkType', 'TEXT');
  await ensureColumn('tasks', 'linkPath', 'TEXT');
  await ensureColumn('tasks', 'linkHostname', 'TEXT');
  await ensureColumn('tasks', 'linkTargetId', 'TEXT');
  await ensureColumn('books', 'category', 'TEXT');
  await ensureColumn('videos', 'category', 'TEXT');
  await ensureColumn('newsCategories', 'url', 'TEXT');
  await ensureColumn('newsCategories', 'previewImage', 'TEXT');
  await ensureColumn('newsCategories', 'previewFavicon', 'TEXT');
  await ensureColumn('wishlistItems', 'purchaseEntryId', 'TEXT');
  await ensureColumn('goals', 'imageUrl', 'TEXT');
  await ensureColumn('tasks', 'linkedMilestoneId', 'TEXT');
  await ensureColumn('books', 'syncedToDrive', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('books', 'driveFileId', 'TEXT');
  // DEFAULT 'short' backfills every existing row automatically — see electronDriver.ts's own note.
  await ensureColumn('webLinks', 'readLength', "TEXT NOT NULL DEFAULT 'short'");

  async function tableIsEmpty(table: string): Promise<boolean> {
    const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
    return ((result.values?.[0]?.count as number) ?? 0) === 0;
  }

  if (await tableIsEmpty('quotes')) {
    const now = new Date().toISOString();
    for (const text of DEFAULT_QUOTES) {
      await db.run('INSERT INTO quotes (id, text, author, createdAt, updatedAt, deletedAt) VALUES (?, ?, NULL, ?, ?, NULL)', [
        uuid(),
        text,
        now,
        now,
      ]);
    }
  }
  if (await tableIsEmpty('newsCategories')) {
    const now = new Date().toISOString();
    for (const cat of DEFAULT_NEWS_CATEGORIES) {
      await db.run(
        'INSERT INTO newsCategories (id, type, name, prompt, locationValue, lastFetchedAt, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL)',
        [uuid(), cat.type, cat.name, cat.prompt, now, now]
      );
    }
  }
  if (await tableIsEmpty('daySchedules')) {
    const now = new Date().toISOString();
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      await db.run(
        'INSERT INTO daySchedules (id, dayOfWeek, wakeTime, sleepTime, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        [uuid(), dayOfWeek, '07:00', '23:00', now, now]
      );
    }
  }

  // Real bug found in the field: pulling a Drive-synced database onto a device reliably produced
  // the exact "database disk image is malformed" corruption on the very next open — not the
  // already-fixed infinite-loop scenario, a single ordinary pull. Root cause: this plugin's
  // native connection (SQLCipher-based even in 'no-encryption' mode) defaults to WAL journal
  // mode, which keeps a `<db>-wal`/`<db>-shm` sidecar pair alongside the main file for pages not
  // yet merged in. A plain `sqlite.closeConnection()` relies on SQLite's own implicit final
  // checkpoint to clean those up, which isn't guaranteed to fully succeed — and both Drive's
  // pull() and local backup's importRawDatabase() immediately overwrite *only* the main file
  // afterward (via FileTransfer.downloadFile / Filesystem.writeFile), never touching the sidecar
  // files at all. A leftover, now-stale WAL/SHM pair sitting next to a completely different main
  // file's bytes the instant the download lands is exactly the kind of inconsistency that
  // produces this failure on next open. Fixed two ways, belt and braces: explicitly switching to
  // `PRAGMA journal_mode=DELETE` before closing forces a real checkpoint and merges/removes the
  // WAL pair as a side effect of leaving WAL mode at all (not relying on an implicit one), and
  // the sidecar files are also explicitly deleted outright right before the overwrite regardless
  // of whether the checkpoint fully cleaned them up.
  async function checkpointAndClose(): Promise<void> {
    try {
      // Switching a WAL-mode connection to DELETE needs an exclusive lock, which — unlike a
      // missing table or a bad query — can genuinely just sit and wait rather than fail fast if
      // anything else has so much as a pending read against this connection. A hard timeout here
      // is deliberate insurance: this pragma is pure cleanup (the sidecar-file deletion below is
      // the real backstop for pull()/importRawDatabase() either way), so it must never be able to
      // turn a close() call into the operation that hangs forever.
      await Promise.race([
        db.execute('PRAGMA journal_mode=DELETE'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('journal_mode=DELETE timed out')), 3000)),
      ]);
    } catch {
      // Best-effort — if the pragma itself fails or times out, closing is still attempted below
      // rather than leaving the connection open.
    }
    await sqlite.closeConnection(DB_NAME, false);
    // Belt and braces, every time this connection closes (not just before importRawDatabase's own
    // overwrite): the pragma above should already remove these as a side effect of leaving WAL
    // mode, but that isn't guaranteed to fully succeed, and close() is also exactly what
    // mobileDriveSync.ts's pull() calls right before FileTransfer.downloadFile overwrites the
    // main file out from under whatever sidecar state is left — the same hazard, reached through
    // a different caller.
    if (dbFilePath) {
      for (const suffix of ['-wal', '-shm', '-journal']) {
        try {
          await Filesystem.deleteFile({ path: `${dbFilePath}${suffix}` });
        } catch {
          // Fine if it doesn't exist — this is pure cleanup, not a required step.
        }
      }
    }
  }

  return {
    async list<T>(table: string, where?: Record<string, unknown>): Promise<T[]> {
      let sql = `SELECT * FROM ${table} WHERE deletedAt IS NULL`;
      const params: unknown[] = [];
      for (const [column, value] of Object.entries(where ?? {})) {
        sql += ` AND ${column} = ?`;
        params.push(value);
      }
      sql += ' ORDER BY createdAt DESC';
      const result = await db.query(sql, params as never[]);
      return (result.values ?? []) as T[];
    },

    async get<T>(table: string, id: string): Promise<T | null> {
      const result = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return ((result.values?.[0] as T) ?? null) as T | null;
    },

    async create<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      await db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, columns.map((c) => row[c]) as never[]);
      return row;
    },

    async update(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
      const columns = Object.keys(patch);
      if (columns.length === 0) return;
      const setClause = columns.map((c) => `${c} = ?`).join(', ');
      await db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...columns.map((c) => patch[c]), id] as never[]);
    },

    async remove(table: string, id: string): Promise<void> {
      await db.run(`UPDATE ${table} SET deletedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
    },

    async hardRemove(table: string, id: string): Promise<void> {
      await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },

    async getSetting(key: string): Promise<string | null> {
      const result = await db.query('SELECT value FROM settings WHERE key = ?', [key]);
      const value = result.values?.[0]?.value as string | undefined;
      if (!value) return value ?? null;
      return SECRET_SETTING_KEYS_WEB.has(key) ? decryptSecretWeb(value) : value;
    },

    async setSetting(key: string, value: string): Promise<void> {
      const stored = SECRET_SETTING_KEYS_WEB.has(key) && value ? await encryptSecretWeb(value) : value;
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        stored,
      ]);
    },

    async getDatabaseFilePath(): Promise<string> {
      return dbFilePath;
    },

    async importRawDatabase(base64: string): Promise<void> {
      if (!dbFilePath) throw new Error('Could not resolve the database file path.');
      await checkpointAndClose();
      await Filesystem.writeFile({ path: dbFilePath, data: base64 });
    },

    async checkpoint(): Promise<void> {
      try {
        await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch {
        // Best-effort — the caller (Drive push) still uploads whatever's on disk either way.
      }
    },

    async close(): Promise<void> {
      await checkpointAndClose();
    },
  };
}
