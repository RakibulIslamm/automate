import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * SHA-256 HMAC sign + timing-safe verify. Used for signing internal queue
 * payloads, webhook bodies, and anything else where we control both ends.
 */

export function signHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  if (typeof signature !== 'string' || signature.length === 0) return false;

  const expected = signHmac(payload, secret);
  if (expected.length !== signature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
