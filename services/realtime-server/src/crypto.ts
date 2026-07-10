import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { config } from './config.js';

// Mirror of the SvelteKit at-rest crypto (src/lib/server/crypto.ts). Kept in-sync by
// contract: same ALGO + HKDF params so ciphertext written here decrypts in the web app.

const ALGO = 'aes-256-gcm';

function masterKey(): Buffer {
  const key = Buffer.from(config.transcriptMasterKey, 'base64');
  if (key.length !== 32) throw new Error('TRANSCRIPT_MASTER_KEY must be 32 bytes (base64)');
  return key;
}

function deriveKey(keyRef: string): Buffer {
  const salt = Buffer.from(keyRef, 'base64');
  return Buffer.from(hkdfSync('sha256', masterKey(), salt, Buffer.from('meet-plus-session'), 32));
}

export function encrypt(plaintext: string, keyRef: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(keyRef), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), ct.toString('base64'), tag.toString('base64')].join('.');
}
