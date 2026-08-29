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

import { shell } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import type { ElectronDataStore } from '@life-manager/db';

const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
const DRIVE_FOLDER_NAME = 'PakCyberbot Life Manager';
const DB_FILE_NAME = 'life-manager.sqlite';
const OAUTH_TIMEOUT_MS = 120_000;

export interface DriveSyncResult {
  ok: boolean;
  error?: string;
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
    return {
      connected: !!store.getSetting('googleRefreshToken'),
      email: store.getSetting('googleConnectedEmail'),
      lastPushedAt: store.getSetting('lastPushedAt'),
      lastPulledAt: store.getSetting('lastPulledAt'),
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

      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          const errorParam = url.searchParams.get('error');
          const code = url.searchParams.get('code');

          if (errorParam) {
            res.end('<html><body>Sign-in was cancelled. You can close this tab.</body></html>');
            server.close();
            finish({ ok: false, error: 'Sign-in was cancelled.' });
            return;
          }
          if (!code) {
            res.end('Missing authorization code.');
            return;
          }

          res.end('<html><body>Connected — you can close this tab and return to the app.</body></html>');
          server.close();

          const address = server.address();
          const port = typeof address === 'object' && address ? address.port : 0;
          const redirectUri = `http://127.0.0.1:${port}/`;

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
        const redirectUri = `http://127.0.0.1:${port}/`;

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

  async function findFile(accessToken: string, folderId: string): Promise<string | null> {
    const q = encodeURIComponent(`name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { files?: { id: string }[] };
    return data.files?.[0]?.id ?? null;
  }

  async function push(dbFilePath: string): Promise<DriveSyncResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const existingId = await findFile(accessToken, folderId);
      const fileBytes = fs.readFileSync(dbFilePath);

      const boundary = 'lifemanagersync';
      const metadata = existingId ? {} : { name: DB_FILE_NAME, parents: [folderId] };
      const multipartHead =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const multipartTail = `\r\n--${boundary}--`;
      const body = Buffer.concat([Buffer.from(multipartHead, 'utf-8'), fileBytes, Buffer.from(multipartTail, 'utf-8')]);

      const url = existingId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const res = await fetch(url, {
        method: existingId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { ok: false, error: `Drive upload failed (${res.status}): ${errBody.slice(0, 200)}` };
      }
      store.setSetting('lastPushedAt', new Date().toISOString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function pull(dbFilePath: string): Promise<DriveSyncResult> {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: 'Not connected to Google Drive — connect in Settings first.' };

    try {
      const folderId = await findOrCreateFolder(accessToken);
      const fileId = await findFile(accessToken, folderId);
      if (!fileId) return { ok: false, error: 'No backup found in Drive yet — push from a device first.' };

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `Drive download failed (${res.status}).` };

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dbFilePath, buf);
      store.setSetting('lastPulledAt', new Date().toISOString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  return { connect, disconnect, push, pull, status };
}
