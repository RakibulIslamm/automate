import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/env';
import { ExternalServiceError } from '@/lib/errors';

/**
 * Stripe singleton. We pin to the SDK's bundled `apiVersion` so the
 * types in this codebase always match what we send over the wire.
 *
 * The SDK already retries network failures internally (`maxNetworkRetries`),
 * so we don't double-wrap with `fetchWithRetry`; instead callers should run
 * Stripe calls through `stripeCall(...)` below, which normalises errors to
 * `ExternalServiceError` so the safe-route/action wrappers can surface a
 * clean message to the client.
 */

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      // In BYOK mode the platform key is intentionally absent — callers
      // should route through `getActiveStripe(userId)` instead. Throw
      // loudly here so the bad call site is obvious in the stack trace.
      throw new ExternalServiceError(
        'Stripe',
        'Platform Stripe key is not configured. Use getActiveStripe(userId) in BYOK mode.',
      );
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Wrap any Stripe SDK call. Anything that the SDK rejects with becomes
 * an `ExternalServiceError('Stripe', …)` — except validation-style
 * errors (e.g. customer not found), which we let propagate so the caller
 * can decide whether to retry, create, or surface them.
 */
export async function stripeCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Stripe's SDK throws structured `Stripe.errors.StripeError`s. Network
    // and rate-limit failures map to external; permission/parameter errors
    // should bubble up so the caller can handle them.
    if (
      err instanceof Stripe.errors.StripeConnectionError ||
      err instanceof Stripe.errors.StripeAPIError ||
      err instanceof Stripe.errors.StripeRateLimitError
    ) {
      throw new ExternalServiceError('Stripe', `Stripe ${label} failed.`, err);
    }
    throw err;
  }
}
