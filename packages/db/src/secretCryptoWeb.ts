// Web Crypto (SubtleCrypto) equivalent of secretCrypto.ts, for the Capacitor/mobile
// driver — a WebView has no `node:crypto`. Produces and consumes the EXACT SAME
// `enc:<iv-hex>:<tag-hex>:<data-hex>` format as secretCrypto.ts, using the exact
// same 32-byte AES-256-GCM key (precomputed once via Node's scryptSync from the
// same passphrase+salt, since Web Crypto has no built-in scrypt) — this is what
// lets an encrypted setting (e.g. googleClientSecret) survive a Drive sync
// round-trip between desktop and mobile and be decrypted by whichever side reads
// it next. See secretCrypto.ts for the full rationale on why a hardcoded key is
// an acceptable trade-off for a local-first, no-server app.

// scryptSync('pcb-life-manager-v1-local-secret-do-not-rely-on-this-alone', 'life-manager-settings-salt', 32),
// computed once and hardcoded here since Web Crypto can't derive it itself.
const KEY_HEX = '7270a0032eb7038563104c03a3c0dff385c8dc9c7c1fe0150756efb2734c51f9';
const PREFIX = 'enc:';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array | ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey('raw', hexToBytes(KEY_HEX) as BufferSource, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  }
  return keyPromise;
}

export async function encryptSecretWeb(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  // Web Crypto's AES-GCM output is ciphertext with the 16-byte auth tag appended —
  // split it apart to match secretCrypto.ts's separate iv:tag:data hex format.
  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoded as BufferSource)
  );
  const data = combined.slice(0, combined.length - 16);
  const tag = combined.slice(combined.length - 16);
  return `${PREFIX}${bytesToHex(iv)}:${bytesToHex(tag)}:${bytesToHex(data)}`;
}

export async function decryptSecretWeb(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored; // not encrypted (e.g. legacy/plaintext row) — return as-is
  try {
    const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
    const key = await getKey();
    const iv = hexToBytes(ivHex);
    // Web Crypto's decrypt expects ciphertext+tag concatenated, the reverse of encrypt's split above.
    const combined = new Uint8Array([...hexToBytes(dataHex), ...hexToBytes(tagHex)]);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, combined as BufferSource);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return ''; // corrupted/unreadable — fail closed rather than throw
  }
}

/** Same set as secretCrypto.ts's SECRET_SETTING_KEYS — kept in sync manually since
 * this file can't import from a node:crypto-dependent module without pulling that
 * dependency into the mobile bundle. */
export const SECRET_SETTING_KEYS_WEB = new Set([
  'googleClientId',
  'googleClientSecret',
  'googleRefreshToken',
  'geminiApiKey',
  'openaiApiKey',
  'anthropicApiKey',
]);
