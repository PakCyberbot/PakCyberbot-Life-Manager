// Google Drive push/pull sync, implemented against the plain Drive REST API
// via fetch — no `googleapis` SDK dependency (it's tens of MB for a handful
// of calls we can make directly). Scope is `drive.file`: the app can only
// see files/folders IT creates, never the user's whole Drive — this keeps it
// out of Google's "sensitive scope" verification process, which would
// otherwise be a real barrier for a personal project like this one.
//
// Setup this needs from the user (documented in structure.md §9 and in the
// Settings UI): a free Google Cloud OAuth "Desktop app" client ID + secret,
// pasted into Settings once. Nothing here works without that — there's no
// way to provision Google credentials on someone's behalf.

import { app, shell } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { ElectronDataStore } from '@life-manager/db/src/electronDriver';

const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
const DRIVE_FOLDER_NAME = 'PakCyberbot Life Manager';
const BOOKS_FOLDER_NAME = 'Books';
const DB_FILE_NAME = 'life-manager.sqlite';
const OAUTH_TIMEOUT_MS = 120_000;

// lastPushedAt/lastPulledAt/driveFileModifiedTime are all genuinely per-device facts ("what does
// THIS device believe about its last sync"), yet they used to live as rows in the synced SQLite
// database itself — the exact thing that gets overwritten wholesale on every pull and re-read
// fresh from disk on the very next launch. That's a real bug, not just an odd modeling choice:
// push() read dbFilePath's bytes for upload *before* recording the new driveFileModifiedTime, so
// every pushed snapshot's own embedded value was always one version stale; pull() then tried to
// correct it by writing to the *pre-pull* in-memory store, but that correction is an ElectronData-
// Store write, which is debounced (~250ms) before it reaches disk — and Auto Sync's pull-on-
// startup calls app.exit() immediately after a real pull, well before that debounce fires, so the
// correction was silently discarded every single time. The freshly-pulled file on disk therefore
// always carried the same stale value forever, so pullIfNewer's very next comparison saw "remote
// is newer" again on every subsequent launch — an infinite pull-and-relaunch loop, confirmed live.
// Fixed by moving all three out of the synced database into a small sidecar JSON file next to it,
// written with a plain synchronous fs call (no debounce, no dependency on the store's lifecycle or
// on process-exit timing) that the sync operation itself can never overwrite.
interface DriveSyncState {
  lastPushedAt?: string;
  lastPulledAt?: string;
  driveFileModifiedTime?: string;
}

function driveSyncStatePath(): string {
  return path.join(app.getPath('userData'), 'drive-sync-state.json');
}

function readDriveSyncState(): DriveSyncState {
  try {
    return JSON.parse(fs.readFileSync(driveSyncStatePath(), 'utf-8')) as DriveSyncState;
  } catch {
    return {}; // no sidecar yet (fresh install, or never synced) — every field reads as unset
  }
}

function writeDriveSyncState(patch: DriveSyncState): void {
  try {
    const next = { ...readDriveSyncState(), ...patch };
    fs.writeFileSync(driveSyncStatePath(), JSON.stringify(next));
  } catch {
    // Best-effort — worst case pullIfNewer treats the next check as "maybe newer" again, the same
    // degraded-but-safe fallback the old design always had, not a new failure mode.
  }
}

export interface DriveUploadBookResult extends DriveSyncResult {
  fileId?: string;
}

export interface DriveSyncResult {
  ok: boolean;
  error?: string;
}

export interface DrivePullIfNewerResult extends DriveSyncResult {
  /** True when a real pull happened; false when the remote copy wasn't newer than what was last
   * pushed/pulled and nothing was downloaded (or there's nothing in Drive yet) — the caller
   * (auto-sync's pull-on-startup) uses this to decide whether it's safe to relaunch. */
  skipped?: boolean;
}

export interface DriveConnectResult extends DriveSyncResult {
  email?: string;
}

export interface DriveStatus {
  connected: boolean;
  email: string | null;
  lastPushedAt: string | null;
  lastPulledAt: string | null;
}

export function createDriveSync(store: ElectronDataStore) {
  function credentials() {
    return {
      clientId: store.getSetting('googleClientId'),
      clientSecret: store.getSetting('googleClientSecret'),
    };
  }

  async function getAccessToken(): Promise<string | null> {
    const { clientId, clientSecret } = credentials();
    const refreshToken = store.getSetting('googleRefreshToken');
    if (!clientId || !clientSecret || !refreshToken) return null;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  }

  function status(): DriveStatus {
    const syncState = readDriveSyncState();
    return {
      connected: !!store.getSetting('googleRefreshToken'),
      email: store.getSetting('googleConnectedEmail'),
      lastPushedAt: syncState.lastPushedAt ?? null,
      lastPulledAt: syncState.lastPulledAt ?? null,
    };
  }

  function disconnect(): void {
    store.setSetting('googleRefreshToken', '');
    store.setSetting('googleConnectedEmail', '');
  }

  /** Runs the installed-app OAuth loopback flow (RFC 8252): open the system
   * browser to Google's consent screen, catch the redirect on a temporary
   * localhost server, exchange the code for tokens. */
  function connect(): Promise<DriveConnectResult> {
    const { clientId, clientSecret } = credentials();
    if (!clientId || !clientSecret) {
      return Promise.resolve({ ok: false, error: 'Add your Google Client ID and Secret in Settings first.' });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: DriveConnectResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };

      // Captured once, when the server starts listening, and reused for both
      // the authorization request AND the token exchange — they must be
      // byte-for-byte identical or Google rejects the exchange. Previously
      // this was *recomputed* from server.address() inside the request
      // handler, after server.close() had already been called; Node nulls
      // the server's internal handle synchronously inside close(), so
      // address() then returns null and the port silently fell back to 0
      // (`http://127.0.0.1:0/`) — a redirect_uri that could never match,
      // so the exchange failed even though the browser had already shown
      // "Connected" (that response is sent before the mismatched exchange
      // ever runs). Confirmed live: the browser reached the success page,
      // but the app never picked up a refresh token.
      let redirectUri = '';

      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          const errorParam = url.searchParams.get('error');
          const code = url.searchParams.get('code');

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

          if (errorParam) {
            res.end('<html><head><meta charset="utf-8"></head><body>Sign-in was cancelled. You can close this tab.</body></html>');
            server.close();
            finish({ ok: false, error: 'Sign-in was cancelled.' });
            return;
          }
          if (!code) {
            res.end('Missing authorization code.');
            return;
          }

          res.end(
            '<html><head><meta charset="utf-8"></head><body>Connected — you can close this tab and return to the app.</body></html>'
          );
          server.close();

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri,
            }),
          });
          const tokenData = (await tokenRes.json()) as {
            refresh_token?: string;
            access_token?: string;
            error_description?: string;
          };

          if (!tokenRes.ok || !tokenData.refresh_token) {
            finish({
              ok: false,
              error:
                tokenData.error_description ??
                "Google didn't return a refresh token. If you've connected before, revoke access at myaccount.google.com/permissions and try again.",
            });
            return;
          }
          store.setSetting('googleRefreshToken', tokenData.refresh_token);

          let email: string | undefined;
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (userRes.ok) email = ((await userRes.json()) as { email?: string }).email;
          } catch {
            // Non-fatal — connection still succeeded even if we can't show an email.
          }
          if (email) store.setSetting('googleConnectedEmail', email);

          finish({ ok: true, email });
        } catch (err) {
          finish({ ok: false, error: String(err) });
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        redirectUri = `http://127.0.0.1:${port}/`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        void shell.openExternal(authUrl.toString());
      });

      const timeout = setTimeout(() => {
        try {
          server.close();
        } catch {
          // already closed
        }
        finish({ ok: false, error: 'Timed out waiting for Google sign-in.' });
      }, OAUTH_TIMEOUT_MS);
    });
  }

  async function findOrCreateFolder(accessToken: string): Promise<string> {
    const q = encodeURIComponent(
      `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listData = (await listRes.json()) as { files?: { id: string }[] };
    if (listData.files?.length) return listData.files[0].id;

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    const createData = (await createRes.json()) as { id: string };
    return createData.id;
  }

  /** Same find-or-create shape as findOrCreateFolder above, generalized to nest one folder inside
   * another — used to get/create the "Books" subfolder inside the main Drive folder. */
  async function findOrCreateSubfolder(accessToken: string, name: string, parentId: string): Promise<string> {
    const q = encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    );
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listData = (await listRes.json()) as { files?: { id: string }[] };
    if (listData.files?.length) return listData.files[0].id;

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    const createData = (await createRes.json()) as { id: string };
    return createData.id;
  }

  async function findFile(accessToken: string, folderId: string): Promise<{ id: string; modifiedTime: string } | null> {
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { files?: { id: string; modifiedTime: string }[] };
    return data.files?.[0] ?? null;
  }

  async function push(dbFilePath: string): Promise<DriveSyncResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const existing = await findFile(accessToken, folderId);
      const fileBytes = fs.readFileSync(dbFilePath);

      const boundary = 'lifemanagersync';
      const metadata = existing ? {} : { name: DB_FILE_NAME, parents: [folderId] };
      const multipartHead =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const multipartTail = `\r\n--${boundary}--`;
      const body = Buffer.concat([Buffer.from(multipartHead, 'utf-8'), fileBytes, Buffer.from(multipartTail, 'utf-8')]);

      // fields=id,modifiedTime so the response itself carries the timestamp auto-sync's
      // pullIfNewer compares against — no extra round trip needed to learn what we just pushed.
      const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';

      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { ok: false, error: `Drive upload failed (${res.status}): ${errBody.slice(0, 200)}` };
      }
      const uploaded = (await res.json()) as { modifiedTime?: string };
      // Spread order matters: an explicit `driveFileModifiedTime: undefined` in the patch would
      // still overwrite the previously-saved value with undefined once JSON.stringify drops the
      // key — so only include it when Drive actually returned one.
      writeDriveSyncState({
        lastPushedAt: new Date().toISOString(),
        ...(uploaded.modifiedTime ? { driveFileModifiedTime: uploaded.modifiedTime } : {}),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /** Per-book "Sync to mobile" — uploads a PDF's bytes (already read/base64-encoded by the
   * caller, same as every other data: URI in this app) into a "Books" subfolder inside the main
   * Drive folder, distinct from the database's own uploadBookFile-free push above. Re-uploads
   * overwrite the existing file (found by name) rather than creating a duplicate, so toggling
   * "Sync to mobile" off then on again — or a real re-sync — replaces content in place. */
  async function uploadBookFile(base64: string, filename: string): Promise<DriveUploadBookResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const parentId = await findOrCreateFolder(accessToken);
      const booksFolderId = await findOrCreateSubfolder(accessToken, BOOKS_FOLDER_NAME, parentId);

      const q = encodeURIComponent(`name='${filename}' and '${booksFolderId}' in parents and trashed=false`);
      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const listData = (await listRes.json()) as { files?: { id: string }[] };
      const existingId = listData.files?.[0]?.id ?? null;

      const fileBytes = Buffer.from(base64, 'base64');
      const boundary = 'lifemanagerbooksync';
      const metadata = existingId ? {} : { name: filename, parents: [booksFolderId] };
      const multipartHead =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
      const multipartTail = `\r\n--${boundary}--`;
      const body = Buffer.concat([Buffer.from(multipartHead, 'utf-8'), fileBytes, Buffer.from(multipartTail, 'utf-8')]);

      const url = existingId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';

      const res = await fetch(url, {
        method: existingId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { ok: false, error: `Drive upload failed (${res.status}): ${errBody.slice(0, 200)}` };
      }
      const uploaded = (await res.json()) as { id?: string };
      if (!uploaded.id) return { ok: false, error: 'Drive did not return a file id.' };
      return { ok: true, fileId: uploaded.id };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function pull(dbFilePath: string): Promise<DriveSyncResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const file = await findFile(accessToken, folderId);
      if (!file) return { ok: false, error: 'No backup found in Drive yet — push from a device first.' };

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `Drive download failed (${res.status}).` };

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dbFilePath, buf);
      // A plain, immediate fs write to the sidecar file, not store.setSetting — this has to
      // survive the app.exit() that Auto Sync's pull-on-startup fires right after this returns,
      // which a debounced ElectronDataStore write never would (see the top-of-file comment).
      writeDriveSyncState({ lastPulledAt: new Date().toISOString(), driveFileModifiedTime: file.modifiedTime });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /** Auto-sync's pull-on-startup wrapper: looks up the remote file's modifiedTime and only does a
   * real pull (which overwrites the local DB and relaunches the app — see pull() above/main.ts)
   * when it's strictly newer than driveFileModifiedTime, the timestamp recorded after this
   * device's own last successful push or pull. Without this check, calling pull() unconditionally
   * on every startup would force-relaunch the app every single time it opens, even when nothing
   * on Drive actually changed since last time. Never throws on a network failure — returns
   * `{ ok: false, error }` so the caller can boot normally and show a transient failure toast
   * instead of blocking startup. */
  async function pullIfNewer(dbFilePath: string): Promise<DrivePullIfNewerResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive.', skipped: true };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const file = await findFile(accessToken, folderId);
      if (!file) return { ok: true, skipped: true }; // nothing pushed yet anywhere — nothing to pull

      const lastKnown = readDriveSyncState().driveFileModifiedTime ?? null;
      const isNewer = !lastKnown || new Date(file.modifiedTime).getTime() > new Date(lastKnown).getTime();
      if (!isNewer) return { ok: true, skipped: true };

      return await pull(dbFilePath);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  return { connect, disconnect, push, pull, pullIfNewer, uploadBookFile, status };
}
