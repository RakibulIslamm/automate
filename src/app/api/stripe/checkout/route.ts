import { z } from 'zod';
import { safeRoute } from '@/lib/safe-route';
import { requireUser } from '@/lib/auth/guards';
import { ExternalServiceError, ValidationError } from '@/lib/errors';
import { env } from '@/lib/env';
import { connectDb } from '@/lib/db/connect';
import { User, type Plan } from '@/lib/db/models';
import { stripe, stripeCall } from '@/lib/stripe/client';
import { getPlan } from '@/lib/stripe/plans';

/**
 * POST /api/stripe/checkout — kick off a subscription checkout for one
 * of the paid plans. Creates the Stripe customer on first hit and
 * caches the id on the user row so subsequent checkouts re-use it.
 *
 * Both the flat-fee price and the metered overage price are added as
 * line items; the metered line has no quantity (Stripe bills it via
 * meter events from the executor).
 */

const bodySchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
});

export const POST = safeRoute<z.infer<typeof bodySchema>, { url: string }>({
  schema: bodySchema,
  handler: async ({ plan }) => {
    const user = await requireUser();
    const planDef = getPlan(plan as Plan);

    if (!planDef.priceId || !planDef.overagePriceId) {
      // Operator forgot to wire the price ids — log it server-side, give
      // the user a generic message (no env-var names in the toast).
      // eslint-disable-next-line no-console
      console.error('[stripe.checkout] missing price ids for plan', { plan });
      throw new ValidationError('This plan isn\'t available right now. Try another.');
    }

    await connectDb();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeCall('create customer', () =>
        stripe().customers.create({
          email: user.email,
          name: user.name ?? undefined,
          metadata: { userId: String(user._id) },
        }),
      );
      customerId = customer.id;
      await User.updateOne(
        { _id: user._id },
        { $set: { stripeCustomerId: customer.id } },
      );
    }

    const successUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard/billing?status=success`;
    const cancelUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard/billing?status=cancel`;

    const session = await stripeCall('create checkout session', () =>
      stripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          { price: planDef.priceId!, quantity: 1 },
          { price: planDef.overagePriceId! },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: String(user._id),
        subscription_data: {
          metadata: { userId: String(user._id), plan },
        },
        allow_promotion_codes: true,
      }),
    );

    if (!session.url) {
      throw new ExternalServiceError('Stripe', 'Stripe didn\'t return a checkout URL.');
    }

    return { url: session.url };
  },
});
