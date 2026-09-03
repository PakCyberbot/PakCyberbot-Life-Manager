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
import { FileTransfer } from '@capacitor/file-transfer';
import type { DriveApi, DriveConnectResult, DrivePullIfNewerResult, DriveStatus } from '@life-manager/core';
import type { MobileDataStore } from '@life-manager/db/src/capacitorDriver';
import { LoopbackAuth } from '../native/loopbackAuth';

const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
const DRIVE_FOLDER_NAME = 'PakCyberbot Life Manager';
const DB_FILE_NAME = 'life-manager.sqlite';
const OAUTH_TIMEOUT_MS = 120_000;

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

  async function status(): Promise<DriveStatus> {
    return {
      connected: !!(await store.getSetting('googleRefreshToken')),
      email: await store.getSetting('googleConnectedEmail'),
      lastPushedAt: await store.getSetting('lastPushedAt'),
      lastPulledAt: await store.getSetting('lastPulledAt'),
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
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: event.code,
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
            await store.setSetting('googleRefreshToken', tokenData.refresh_token);

            let email: string | undefined;
            try {
              const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              });
              if (userRes.ok) email = ((await userRes.json()) as { email?: string }).email;
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

  async function findFile(accessToken: string, folderId: string): Promise<{ id: string; modifiedTime: string } | null> {
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { files?: { id: string; modifiedTime: string }[] };
    return data.files?.[0] ?? null;
  }

  async function push(): Promise<{ ok: boolean; error?: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const dbFilePath = await store.getDatabaseFilePath();
      if (!dbFilePath) return { ok: false, error: 'Could not locate the database file on this device.' };

      const folderId = await findOrCreateFolder(accessToken);
      const existing = await findFile(accessToken, folderId);
      let fileId = existing?.id ?? null;

      // Drive's uploadType=media endpoint only sets file *content* — a brand
      // new file needs its metadata (name/parent) created first via a plain
      // JSON POST, same as desktop, before its content can be set this way.
      if (!fileId) {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: DB_FILE_NAME, parents: [folderId] }),
        });
        const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
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
      });
      const code = Number(result.responseCode);
      if (code < 200 || code >= 300) {
        return { ok: false, error: `Drive upload failed (${result.responseCode}): ${(result.response ?? '').slice(0, 200)}` };
      }
      await store.setSetting('lastPushedAt', new Date().toISOString());
      try {
        const uploaded = JSON.parse(result.response ?? '{}') as { modifiedTime?: string };
        if (uploaded.modifiedTime) await store.setSetting('driveFileModifiedTime', uploaded.modifiedTime);
      } catch {
        // Non-fatal — pullIfNewer just won't have a precise baseline until the next successful
        // push/pull sets one; it degrades to treating any remote file as "maybe newer."
      }
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

      // Written to the *current* (pre-pull) database, same relative ordering
      // as desktop's driveSync.ts — it's really only a courtesy, not something
      // that reliably survives: the file gets overwritten wholesale right
      // after, so whatever lastPulledAt the pulled file itself already had
      // (from whenever its source device last pulled) is what actually
      // persists, same known non-issue already accepted on desktop (see
      // driveSync.ts's own comment on the in-memory-vs-file staleness this
      // pattern lives with, resolved there by exiting before anything can
      // flush stale state back over the pulled file).
      await store.setSetting('lastPulledAt', new Date().toISOString());
      await store.setSetting('driveFileModifiedTime', file.modifiedTime);

      // Release the file lock before overwriting it — the same reasoning as
      // importRawDatabase's local-backup-import path.
      await store.close();

      await FileTransfer.downloadFile({
        url: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        path: dbFilePath,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

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

      const lastKnown = await store.getSetting('driveFileModifiedTime');
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

  return { connect, disconnect, push, pull, pullIfNewer, onAutoSyncFailed, status };
}
