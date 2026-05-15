/**
 * Encrypt/decrypt Drive OAuth tokens for at-rest storage.
 * AES-256-GCM with a key derived from SESSION_SECRET via scrypt.
 * Output is base64url: `{iv}.{ciphertext}.{authTag}` — versioned by the
 * literal `v1.` prefix so we can rotate the algorithm later without
 * breaking existing rows.
 *
 * The worker uses an identical implementation so it can decrypt
 * tokens stored by the app.
 */
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';

const VERSION = 'v1';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT = 'video-maker-drive-tokens';

let _key: Buffer | null = null;
function getKey(): Buffer {
  if (_key) return _key;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET env var must be at least 32 characters');
  }
  _key = scryptSync(secret, SALT, KEY_LEN);
  return _key;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptToken(blob: string): string {
  const parts = blob.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('invalid encrypted token format');
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const ct = Buffer.from(ctB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
