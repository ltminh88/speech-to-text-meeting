import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// AES-256-GCM at-rest encryption for session titles (and, in Phase 2, transcripts).
// Per-session key is HKDF-derived from a single master key + a per-session salt (key ref),
// so a leaked ciphertext for one session does not weaken others.

const ALGO = 'aes-256-gcm';

function masterKey(): Buffer {
  const b64 = env.TRANSCRIPT_MASTER_KEY;
  if (!b64) throw new Error('TRANSCRIPT_MASTER_KEY not configured');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('TRANSCRIPT_MASTER_KEY must be 32 bytes (base64)');
  return key;
}

/** Generate a per-session key reference (salt) to store in sessions.encryption_key_ref. */
export function newKeyRef(): string {
  return randomBytes(16).toString('base64');
}

function deriveKey(keyRef: string): Buffer {
  const salt = Buffer.from(keyRef, 'base64');
  return Buffer.from(hkdfSync('sha256', masterKey(), salt, Buffer.from('meet-plus-session'), 32));
}

/** Encrypt plaintext → compact "iv.ciphertext.tag" (all base64). */
export function encrypt(plaintext: string, keyRef: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(keyRef), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), ct.toString('base64'), tag.toString('base64')].join('.');
}

/** Decrypt "iv.ciphertext.tag" back to plaintext. Throws on tamper/wrong key. */
export function decrypt(payload: string, keyRef: string): string {
  const [ivB64, ctB64, tagB64] = payload.split('.');
  if (!ivB64 || !ctB64 || !tagB64) throw new Error('malformed ciphertext');
  const decipher = createDecipheriv(ALGO, deriveKey(keyRef), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
