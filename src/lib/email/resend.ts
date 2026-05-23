import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';

/**
 * Singleton Resend client. Used for transactional sends like the
 * payment-failed email kicked off from the Stripe webhook.
 */

let _resend: Resend | null = null;
export function resend(): Resend {
  if (!_resend) _resend = new Resend(env.AUTH_RESEND_KEY);
  return _resend;
}
