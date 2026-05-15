/**
 * Mirror of src/modules/video/drive/crypto.ts in the Next.js app.
 * MUST stay byte-compatible — the app encrypts Drive tokens, the
 * worker decrypts them. Same algorithm, same SESSION_SECRET-derived
 * key, same `v1.iv.ct.tag` base64url format.
 */
import { scryptSync, createDecipheriv } from 'node:crypto';

const VERSION = 'v1';
const KEY_LEN = 32;
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
