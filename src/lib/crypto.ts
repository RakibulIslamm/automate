import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * AES-256-GCM authenticated encryption for at-rest secrets (OAuth tokens,
 * connection credentials). Format: `iv:authTag:ciphertext`, all hex-encoded.
 * GCM gives us both confidentiality and tamper detection — a modified
 * ciphertext or tag fails on decrypt().
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}).`);
  }
  cachedKey = key;
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext: expected "iv:tag:data".');
  }
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function encryptJSON<T>(value: T): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJSON<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
