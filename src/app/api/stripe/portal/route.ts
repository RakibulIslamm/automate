import { z } from 'zod';
import { safeRoute } from '@/lib/safe-route';
import { requireUser } from '@/lib/auth/guards';
import { ValidationError } from '@/lib/errors';
import { env } from '@/lib/env';
import { stripe, stripeCall } from '@/lib/stripe/client';

/**
 * POST /api/stripe/portal — opens the Stripe-hosted customer portal so
 * the user can update card details, switch plans, or cancel. We require
 * an existing customer id; users with no subscription yet should hit
 * `/api/stripe/checkout` instead.
 */
export const POST = safeRoute<unknown, { url: string }>({
  schema: z.object({}).default({}) as unknown as import('zod').ZodType<unknown>,
  handler: async () => {
    const user = await requireUser();
    if (!user.stripeCustomerId) {
      throw new ValidationError('You don\'t have a subscription yet. Pick a plan first.');
    }

    const returnUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard/billing`;
    const session = await stripeCall('create portal session', () =>
      stripe().billingPortal.sessions.create({
        customer: user.stripeCustomerId!,
        return_url: returnUrl,
      }),
    );

    return { url: session.url };
  },
});
