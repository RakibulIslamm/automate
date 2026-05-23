import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';
import { getPlan } from '@/lib/stripe/plans';
import { stripe, stripeCall } from '@/lib/stripe/client';
import { logError } from '@/lib/tracking/log-error';

export interface RecordRunInput {
  userId: string;
  /** WorkflowRun._id — used as the Stripe meter event idempotency key. */
  runId: string;
}

/**
 * Increment the user's runs-this-period counter, then — if they're past
 * the included quota AND the plan has an overage price + Stripe customer
 * — emit a meter event so Stripe bills it.
 *
 * Meter Events v2 are the current pattern (April 2025+); the older
 * `subscriptionItems.usageRecords` API is deprecated. We send exactly one
 * event per run with `identifier = runId` so retries don't double-bill.
 *
 * Never throws — logs and swallows. A billing failure should not break
 * a customer's workflow execution.
 */
export async function recordRunUsage({ userId, runId }: RecordRunInput): Promise<void> {
  await connectDb();
  const updated = await User.findByIdAndUpdate(
    new Types.ObjectId(userId),
    { $inc: { 'usage.runsThisPeriod': 1 } },
    { new: true, select: 'plan usage stripeCustomerId' },
  ).lean();
  if (!updated) return;

  const plan = getPlan(updated.plan ?? 'free');
  const runsThisPeriod = updated.usage?.runsThisPeriod ?? 0;
  const overOriginalQuota = runsThisPeriod > plan.runsPerMonth;

  if (!overOriginalQuota) return; // included in the flat monthly fee
  if (!plan.overagePriceId) return; // no overage configured
  if (!updated.stripeCustomerId) return; // no live subscription

  try {
    await stripeCall('meter event report', () =>
      stripe().v2.billing.meterEvents.create({
        event_name: 'workflow_run',
        payload: {
          stripe_customer_id: updated.stripeCustomerId!,
          value: '1',
        },
        identifier: runId,
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[usage] meter event failed', { runId, userId, err });
    await logError(err, { source: 'usage.record-run.meter' });
  }
}
