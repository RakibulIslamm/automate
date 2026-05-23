import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { env } from '@/lib/env';
import { connectDb } from '@/lib/db/connect';
import {
  BillingEvent,
  User,
  type Plan,
  type SubscriptionStatus,
} from '@/lib/db/models';
import { planForPriceId } from '@/lib/stripe/plans';
import { resetUsagePeriod } from '@/lib/usage/reset-period';
import { resend } from '@/lib/email/resend';
import { renderPaymentFailedEmail } from '@/lib/email/templates/payment-failed';
import { logError } from '@/lib/tracking/log-error';

/**
 * Stripe webhook. We DON'T use `safeRoute` here because the signature
 * verifier needs the exact raw bytes — calling `req.json()` would
 * normalise the body and break the HMAC check.
 *
 * Idempotency: every event is recorded in `BillingEvent` keyed on its
 * `stripeEventId`. The unique index there makes redelivery a no-op.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Missing signature header.' } },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe.webhook] signature verification failed', err);
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Signature check failed.' } },
      { status: 400 },
    );
  }

  try {
    await connectDb();

    // Idempotency guard — bail early if we've seen this event id before.
    // BillingEvent.stripeEventId is uniquely indexed, so a parallel
    // duplicate gets rejected at insert time too.
    const already = await BillingEvent.exists({ stripeEventId: event.id });
    if (already) return NextResponse.json({ data: { ok: true, duplicate: true } });

    await dispatchEvent(event);

    // Best-effort log of everything that flows through, even unhandled
    // event types. Helpful for debugging without enabling Stripe's CLI.
    await BillingEvent.create({
      userId: extractUserId(event) ?? new Types.ObjectId(),
      type: event.type,
      stripeEventId: event.id,
      data: event.data.object,
    }).catch(() => undefined);

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    await logError(err, { source: 'stripe.webhook', extra: { eventType: event.type } });
    // eslint-disable-next-line no-console
    console.error('[stripe.webhook] dispatch failed', err);
    // Return 500 so Stripe retries — webhook handlers must be idempotent
    // for this to be safe; we are.
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Webhook handling failed.' } },
      { status: 500 },
    );
  }
}

async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    case 'invoice.paid':
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case 'invoice.payment_failed':
      return handlePaymentFailed(event.data.object as Stripe.Invoice);
    default:
      // Unhandled event types are still recorded by the caller for visibility.
      return;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId || !Types.ObjectId.isValid(userId)) return;

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId) return;
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const plan = planFromSubscription(sub) ?? 'free';

  const periodStart = subscriptionPeriodStart(sub);
  const periodEnd = subscriptionPeriodEnd(sub);

  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        plan,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: mapStatus(sub.status),
        'usage.runsThisPeriod': 0,
        'usage.periodStart': periodStart,
        'usage.periodEnd': periodEnd,
      },
    },
  );
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdForSub(sub);
  if (!userId) return;
  const plan = planFromSubscription(sub) ?? 'free';
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        plan,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: mapStatus(sub.status),
      },
    },
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdForSub(sub);
  if (!userId) return;
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        plan: 'free' as Plan,
        subscriptionStatus: 'canceled' as SubscriptionStatus,
      },
      $unset: { stripeSubscriptionId: '' },
    },
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean();
  if (!user) return;

  const periodStartUnix = invoice.lines.data[0]?.period?.start;
  const periodEndUnix = invoice.lines.data[0]?.period?.end;
  if (!periodStartUnix || !periodEndUnix) return;

  await resetUsagePeriod({
    userId: String(user._id),
    periodStart: new Date(periodStartUnix * 1000),
    periodEnd: new Date(periodEndUnix * 1000),
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await User.findOne({ stripeCustomerId: customerId })
    .select('_id email name')
    .lean();
  if (!user) return;

  await User.updateOne(
    { _id: user._id },
    { $set: { subscriptionStatus: 'past_due' as SubscriptionStatus } },
  );

  try {
    const { subject, html, text } = renderPaymentFailedEmail({
      name: user.name ?? null,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
    });
    await resend().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: user.email,
      subject,
      html,
      text,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe.webhook] payment_failed email send failed', err);
  }
}

/* ───────────────────────── helpers ───────────────────────── */

function extractUserId(event: Stripe.Event): Types.ObjectId | null {
  const obj = event.data.object as { client_reference_id?: string; metadata?: Record<string, string> };
  const candidate = obj.client_reference_id ?? obj.metadata?.userId;
  if (candidate && Types.ObjectId.isValid(candidate)) return new Types.ObjectId(candidate);
  return null;
}

async function resolveUserIdForSub(sub: Stripe.Subscription): Promise<string | null> {
  const metaUserId = sub.metadata?.userId;
  if (metaUserId && Types.ObjectId.isValid(metaUserId)) return metaUserId;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const u = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean();
  return u ? String(u._id) : null;
}

function planFromSubscription(sub: Stripe.Subscription): Plan | null {
  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const plan = planForPriceId(priceId);
    if (plan) return plan;
  }
  return null;
}

function subscriptionPeriodStart(sub: Stripe.Subscription): Date {
  const item = sub.items.data[0];
  const start = item?.current_period_start;
  return start ? new Date(start * 1000) : new Date();
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date {
  const item = sub.items.data[0];
  const end = item?.current_period_end;
  return end ? new Date(end * 1000) : new Date(Date.now() + 30 * 24 * 3600 * 1000);
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    default:
      return 'none';
  }
}
