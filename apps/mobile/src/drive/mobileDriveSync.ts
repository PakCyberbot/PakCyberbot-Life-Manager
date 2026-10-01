// Mobile's Google Drive push/pull — deliberately the same technique as
// apps/desktop/electron/driveSync.ts (a pasted Google Cloud OAuth "Desktop
// app" Client ID + Secret, loopback redirect, drive.file scope), per the
// user's explicit ask to reuse it rather than a different mobile-specific
// OAuth pattern. See CLAUDE.md's Mobile app section for the full research
// behind why this (and not a custom URL scheme, which Google has blocked
// for Android) is what actually works, and the one honest caveat: a
// Desktop-app-type client's loopback flow staying usable from an Android
// app is a side effect of Google's deprecation being keyed to client type
// rather than device, not Google's prescribed mobile pattern.
//
// What differs from desktop, and why: a WebView/JS context can't bind a raw
// listening socket, so the loopback capture itself runs through the
// app-local native LoopbackAuthPlugin (see native/loopbackAuth.ts) instead
// of node:http. Push/pull use @capacitor/file-transfer's uploadFile/
// downloadFile against the live database file's real path (see
// capacitorDriver.ts's getDatabaseFilePath()) rather than a hand-built
// multipart body — CapacitorHttp (the fetch/XHR patch used for every other
// REST call here) has documented problems with binary/Blob request bodies,
// which is exactly why Capacitor ships file-transfer as a separate,
// purpose-built plugin.

import { Browser } from '@capacitor/browser';
import { CapacitorHttp, type HttpOptions, type HttpResponse } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import type { DriveApi, DriveConnectResult, DrivePullIfNewerResult, DriveStatus, DriveSyncResult } from '@life-manager/core';
import type { MobileDataStore } from '@life-manager/db/src/capacitorDriver';
import { LoopbackAuth } from '../native/loopbackAuth';

const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
const DRIVE_FOLDER_NAME = 'PakCyberbot Life Manager';
const DB_FILE_NAME = 'life-manager.sqlite';
const OAUTH_TIMEOUT_MS = 120_000;

// Real bug found in the field, in two rounds: Pull got stuck indefinitely on "Pulling…" with no
// error and no crash, confirmed still true after capping every one of this file's own calls with
// a plain AbortController-based fetch() timeout (the same fix already applied to mobileApi.ts's
// image fetches) — this device sat well past that timeout window with zero change. The actual
// cause: this file's REST calls went through the global `fetch()` that `CapacitorHttp.enabled:
// true` patches to route through native networking (see capacitor.config.ts) — and that patched
// fetch does not reliably honor an AbortSignal the way a real browser's fetch does, so
// controller.abort() was a silent no-op against it; the underlying native HTTP call just kept
// running with no way for JS to detect or cancel it. `FileTransfer.downloadFile/uploadFile`
// elsewhere in this file were never affected, because that's a separate, purpose-built native
// plugin with its own genuine connectTimeout/readTimeout support — confirmed by reading its own
// type definitions, not assumed. Fixed by calling `CapacitorHttp.request()` directly instead of
// the patched global fetch for every REST call in this file: the exact same native plugin
// FileTransfer already proven to respect timeouts correctly, just its generic HTTP sibling.
const HTTP_TIMEOUT_MS = 20_000;

async function driveFetch(options: HttpOptions): Promise<HttpResponse> {
  return CapacitorHttp.request({ connectTimeout: HTTP_TIMEOUT_MS, readTimeout: HTTP_TIMEOUT_MS, ...options });
}

// lastPushedAt/lastPulledAt/driveFileModifiedTime are genuinely per-device facts ("what does THIS
// device believe about its last sync"), but used to be stored as rows in the synced SQLite
// database itself via store.setSetting — which pull() then wholesale-overwrote on every single
// pull, right after this same function had already tried to correct it (see the old comment this
// replaced: "the file gets overwritten wholesale right after ... same known non-issue already
// accepted on desktop"). That framing was wrong — it wasn't a cosmetic non-issue, it silently
// broke pullIfNewer's own newer-check: the freshly-downloaded database always carried a stale
// driveFileModifiedTime (whatever the pushing device had written into it one version ago), so the
// very next launch's pullIfNewer saw "remote is newer" again and pulled the identical content
// forever — confirmed live as an infinite pull-and-reload loop. Fixed by moving all three out of
// the synced database into localStorage, the same "this is per-device, not synced data" storage
// this codebase already uses for theme — a plain synchronous write the database swap can never
// touch, whatever order it happens relative to the download.
const DRIVE_SYNC_STATE_KEY = 'driveSyncState';

interface DriveSyncState {
  lastPushedAt?: string;
  lastPulledAt?: string;
  driveFileModifiedTime?: string;
}

function readDriveSyncState(): DriveSyncState {
  try {
    const raw = localStorage.getItem(DRIVE_SYNC_STATE_KEY);
    return raw ? (JSON.parse(raw) as DriveSyncState) : {};
  } catch {
    return {};
  }
}

function writeDriveSyncState(patch: DriveSyncState): void {
  try {
    // Only spread in defined fields — an explicit `undefined` value would otherwise get dropped
    // by JSON.stringify and silently erase a previously-saved one.
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    localStorage.setItem(DRIVE_SYNC_STATE_KEY, JSON.stringify({ ...readDriveSyncState(), ...defined }));
  } catch {
    // Best-effort — worst case pullIfNewer treats the next check as "maybe newer" again, the same
    // degraded-but-safe fallback the old design always had, not a new failure mode.
  }
}

export function createMobileDriveSync(store: MobileDataStore): DriveApi {
  // Auto Sync's failure toast has no separate main process to push an IPC event from here — App.tsx
  // both triggers pullIfNewer() at startup AND subscribes via onAutoSyncFailed, same two-step shape
  // as desktop's App.tsx, backed by this plain in-module listener list instead of ipcRenderer.
  let autoSyncFailListeners: Array<(message: string) => void> = [];
  async function credentials() {
    return {
      clientId: await store.getSetting('googleClientId'),
      clientSecret: await store.getSetting('googleClientSecret'),
    };
  }

  async function getAccessToken(): Promise<string | null> {
    const { clientId, clientSecret } = await credentials();
    const refreshToken = await store.getSetting('googleRefreshToken');
    if (!clientId || !clientSecret || !refreshToken) return null;

    const res = await driveFetch({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (res.status < 200 || res.status >= 300) return null;
    return (res.data as { access_token?: string } | undefined)?.access_token ?? null;
  }

  async function status(): Promise<DriveStatus> {
    const syncState = readDriveSyncState();
    return {
      connected: !!(await store.getSetting('googleRefreshToken')),
      email: await store.getSetting('googleConnectedEmail'),
      lastPushedAt: syncState.lastPushedAt ?? null,
      lastPulledAt: syncState.lastPulledAt ?? null,
    };
  }

  async function disconnect(): Promise<void> {
    await store.setSetting('googleRefreshToken', '');
    await store.setSetting('googleConnectedEmail', '');
  }

  function connect(): Promise<DriveConnectResult> {
    return new Promise((resolve) => {
      (async () => {
        const { clientId, clientSecret } = await credentials();
        if (!clientId || !clientSecret) {
          resolve({ ok: false, error: 'Add your Google Client ID and Secret in Settings first.' });
          return;
        }

        let settled = false;
        let listenerHandle: { remove: () => Promise<void> } | null = null;
        const finish = (result: DriveConnectResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          void listenerHandle?.remove();
          void LoopbackAuth.stop();
          resolve(result);
        };

        const timeout = setTimeout(() => finish({ ok: false, error: 'Timed out waiting for Google sign-in.' }), OAUTH_TIMEOUT_MS);

        let port: number;
        try {
          ({ port } = await LoopbackAuth.start());
        } catch (err) {
          finish({ ok: false, error: `Could not start the local sign-in listener: ${String(err)}` });
          return;
        }
        // Reused byte-for-byte for both the authorization request and the token
        // exchange below — the same requirement (and the same bug class, already
        // fixed once on desktop) as driveSync.ts's own redirectUri handling.
        const redirectUri = `http://127.0.0.1:${port}/`;

        listenerHandle = await LoopbackAuth.addListener('redirect', async (event) => {
          if (settled) return;
          void Browser.close().catch(() => {});

          if (event.error) {
            finish({ ok: false, error: 'Sign-in was cancelled.' });
            return;
          }
          if (!event.code) {
            finish({ ok: false, error: 'No authorization code received.' });
            return;
          }

          try {
            const tokenRes = await driveFetch({
              url: 'https://oauth2.googleapis.com/token',
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              data: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: event.code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
              }).toString(),
            });
            const tokenData = (tokenRes.data ?? {}) as {
              refresh_token?: string;
              access_token?: string;
              error_description?: string;
            };

            if (tokenRes.status < 200 || tokenRes.status >= 300 || !tokenData.refresh_token) {
              finish({
                ok: false,
                error:
                  tokenData.error_description ??
                  "Google didn't return a refresh token. If you've connected before, revoke access at myaccount.google.com/permissions and try again.",
              });
              return;
            }
            await store.setSetting('googleRefreshToken', tokenData.refresh_token);

            let email: string | undefined;
            try {
              const userRes = await driveFetch({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              });
              if (userRes.status >= 200 && userRes.status < 300) email = (userRes.data as { email?: string } | undefined)?.email;
            } catch {
              // Non-fatal — connection still succeeded even if we can't show an email.
            }
            if (email) await store.setSetting('googleConnectedEmail', email);

            finish({ ok: true, email });
          } catch (err) {
            finish({ ok: false, error: String(err) });
          }
        });

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        await Browser.open({ url: authUrl.toString() });
      })();
    });
  }

  async function findOrCreateFolder(accessToken: string): Promise<string> {
    const q = encodeURIComponent(
      `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const listRes = await driveFetch({
      url: `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listData = (listRes.data ?? {}) as { files?: { id: string }[] };
    if (listData.files?.length) return listData.files[0].id;

    const createRes = await driveFetch({
      url: 'https://www.googleapis.com/drive/v3/files',
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    return (createRes.data as { id: string }).id;
  }

  async function findFile(accessToken: string, folderId: string): Promise<{ id: string; modifiedTime: string } | null> {
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const res = await driveFetch({
      url: `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (res.data ?? {}) as { files?: { id: string; modifiedTime: string }[] };
    return data.files?.[0] ?? null;
  }

  async function push(): Promise<{ ok: boolean; error?: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const dbFilePath = await store.getDatabaseFilePath();
      if (!dbFilePath) return { ok: false, error: 'Could not locate the database file on this device.' };

      // The native connection stays open across a push (unlike pull/import, which close it
      // first) and defaults to WAL journal mode — without this, whatever was most recently
      // written but not yet checkpointed into the main file could be silently missing from the
      // very bytes about to be uploaded. Doesn't close the connection, just merges the WAL back.
      await store.checkpoint();

      const folderId = await findOrCreateFolder(accessToken);
      const existing = await findFile(accessToken, folderId);
      let fileId = existing?.id ?? null;

      // Drive's uploadType=media endpoint only sets file *content* — a brand
      // new file needs its metadata (name/parent) created first via a plain
      // JSON POST, same as desktop, before its content can be set this way.
      if (!fileId) {
        const createRes = await driveFetch({
          url: 'https://www.googleapis.com/drive/v3/files',
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          data: JSON.stringify({ name: DB_FILE_NAME, parents: [folderId] }),
        });
        const created = (createRes.data ?? {}) as { id?: string; error?: { message?: string } };
        if (!created.id) return { ok: false, error: created.error?.message ?? 'Could not create the Drive file.' };
        fileId = created.id;
      }

      // fields=id,modifiedTime so the response carries the timestamp pullIfNewer compares against
      // — no extra round trip needed to learn what was just pushed, same as desktop's driveSync.ts.
      const result = await FileTransfer.uploadFile({
        url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`,
        path: dbFilePath,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
        connectTimeout: 30_000,
        readTimeout: 30_000,
      });
      const code = Number(result.responseCode);
      if (code < 200 || code >= 300) {
        return { ok: false, error: `Drive upload failed (${result.responseCode}): ${(result.response ?? '').slice(0, 200)}` };
      }
      let driveFileModifiedTime: string | undefined;
      try {
        driveFileModifiedTime = (JSON.parse(result.response ?? '{}') as { modifiedTime?: string }).modifiedTime;
      } catch {
        // Non-fatal — pullIfNewer just won't have a precise baseline until the next successful
        // push/pull sets one; it degrades to treating any remote file as "maybe newer."
      }
      writeDriveSyncState({ lastPushedAt: new Date().toISOString(), driveFileModifiedTime });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function pull(): Promise<{ ok: boolean; error?: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const dbFilePath = await store.getDatabaseFilePath();
      if (!dbFilePath) return { ok: false, error: 'Could not locate the database file on this device.' };

      const folderId = await findOrCreateFolder(accessToken);
      const file = await findFile(accessToken, folderId);
      if (!file) return { ok: false, error: 'No backup found in Drive yet — push from a device first.' };

      // Release the file lock before overwriting it — the same reasoning as
      // importRawDatabase's local-backup-import path.
      await store.close();

      await FileTransfer.downloadFile({
        url: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        path: dbFilePath,
        headers: { Authorization: `Bearer ${accessToken}` },
        // Defaults to 60s otherwise — this file is a personal database, typically a few MB at
        // most, so failing faster surfaces a real network problem sooner than leaving the UI
        // showing "Pulling…" for a full minute with no feedback.
        connectTimeout: 30_000,
        readTimeout: 30_000,
      });

      // localStorage, not store.setSetting — this has to survive the database file having just
      // been overwritten wholesale above, which a setting written *into* that same database never
      // would (see the top-of-file comment).
      writeDriveSyncState({ lastPulledAt: new Date().toISOString(), driveFileModifiedTime: file.modifiedTime });

      // Mirrors desktop's app.relaunch() after a pull — a fresh createCapacitorDataStore()
      // call on reload opens a new connection against the freshly-downloaded file.
      setTimeout(() => window.location.reload(), 400);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /** Auto Sync's pull-on-startup check — called directly from App.tsx (mobile has no separate main
   * process to run this ahead of the renderer the way desktop does). Only does a real pull() when
   * Drive's copy is strictly newer than driveFileModifiedTime, the timestamp this device recorded
   * after its own last successful push or pull — otherwise every app open would reload the page
   * unconditionally. On a genuine failure (not just "nothing newer" or "not connected"), notifies
   * onAutoSyncFailed subscribers so App.tsx can show its 5s toast. */
  async function pullIfNewer(): Promise<DrivePullIfNewerResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive.', skipped: true };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const file = await findFile(accessToken, folderId);
      if (!file) return { ok: true, skipped: true }; // nothing pushed yet anywhere — nothing to pull

      const lastKnown = readDriveSyncState().driveFileModifiedTime ?? null;
      const isNewer = !lastKnown || new Date(file.modifiedTime).getTime() > new Date(lastKnown).getTime();
      if (!isNewer) return { ok: true, skipped: true };

      const result = await pull();
      if (!result.ok) autoSyncFailListeners.forEach((cb) => cb(result.error ?? 'Could not reach Google Drive.'));
      return result;
    } catch (err) {
      const message = String(err);
      autoSyncFailListeners.forEach((cb) => cb(message));
      return { ok: false, error: message };
    }
  }

  function onAutoSyncFailed(callback: (message: string) => void): () => void {
    autoSyncFailListeners.push(callback);
    return () => {
      autoSyncFailListeners = autoSyncFailListeners.filter((cb) => cb !== callback);
    };
  }

  /** Downloads a book PDF desktop synced to Drive's Books/ subfolder into this device's own
   * app-private storage — same Directory.Data convention MobileLibraryScreen's NewBookDialog
   * already uses for a locally-picked PDF, so the result behaves identically to a normally-added
   * book from here on (Library just sets its filePath/hostname to this device's own). */
  async function downloadBookFile(driveFileId: string, bookId: string): Promise<DriveSyncResult & { filePath?: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const filename = `book-drive-${bookId}.pdf`;
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Data });
      const filePath = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;

      const result = await FileTransfer.downloadFile({
        url: `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        path: filePath,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!result.path) return { ok: false, error: 'Download did not complete.' };
      return { ok: true, filePath: result.path };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  return { connect, disconnect, push, pull, pullIfNewer, onAutoSyncFailed, downloadBookFile, status };
}
