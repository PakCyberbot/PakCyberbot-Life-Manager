// At-rest encryption for sensitive settings (API keys, OAuth secrets/tokens),
// using AES-256-GCM with a key derived from a hardcoded app passphrase.
//
// Honest caveat: a hardcoded key can't protect a secret from someone who has
// this app's own source (the key is right there in the codebase) — that's
// true of any purely local, no-server-component desktop app; there's no
// server-side secret to lean on. What this DOES protect against is the much
// more likely case: the raw life-manager.sqlite file (or a cloud backup of
// it, or another app/process scanning disk for plaintext-looking keys)
// exposing your API keys just by being opened in a text/hex viewer. That's
// the actual threat this is aimed at, and it's a real improvement over
// storing keys as plain text — see structure.md.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const APP_PASSPHRASE = 'pcb-life-manager-v1-local-secret-do-not-rely-on-this-alone';
const SALT = 'life-manager-settings-salt';
const KEY = scryptSync(APP_PASSPHRASE, SALT, 32);
const PREFIX = 'enc:';

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // not encrypted (e.g. legacy/plaintext row) — return as-is
  try {
    const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return ''; // corrupted/unreadable — fail closed rather than throw
  }
}

/** Settings keys that hold credentials — encrypted transparently by ElectronDataStore. */
export const SECRET_SETTING_KEYS = new Set([
  'googleClientId',
  'googleClientSecret',
  'googleRefreshToken',
  'geminiApiKey',
  'openaiApiKey',
  'anthropicApiKey',
]);
