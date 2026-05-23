import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';
import { getPlan } from '@/lib/stripe/plans';

export interface QuotaResult {
  allowed: boolean;
  reason?: string;
  /** Numbers exposed so the caller can offer "X / Y runs used" in UI. */
  runsThisPeriod: number;
  runsPerMonth: number;
  overageAllowed: boolean;
}

/**
 * Decide whether `userId` is allowed to start another workflow run.
 *
 * Logic:
 *   - Free / no-overage plans: hard cap at `plan.runsPerMonth`.
 *   - Paid plans with overage: never blocked; over-quota runs get billed
 *     through the Stripe meter (see `recordRunUsage`).
 *
 * Returning `allowed: false` includes a public-safe `reason` the caller
 * can show in a toast — no env paths or operator instructions leak out.
 */
export async function checkCanRunWorkflow(userId: string): Promise<QuotaResult> {
  await connectDb();
  const user = await User.findById(new Types.ObjectId(userId))
    .select('plan usage')
    .lean();

  if (!user) {
    return {
      allowed: false,
      reason: 'Account not found.',
      runsThisPeriod: 0,
      runsPerMonth: 0,
      overageAllowed: false,
    };
  }

  const plan = getPlan(user.plan ?? 'free');
  const runsThisPeriod = user.usage?.runsThisPeriod ?? 0;
  const overageAllowed = plan.overageRateUsd !== null;

  if (runsThisPeriod >= plan.runsPerMonth && !overageAllowed) {
    return {
      allowed: false,
      reason: `You've used all ${plan.runsPerMonth} runs on the ${plan.name} plan this period. Upgrade to keep running workflows.`,
      runsThisPeriod,
      runsPerMonth: plan.runsPerMonth,
      overageAllowed: false,
    };
  }

  return {
    allowed: true,
    runsThisPeriod,
    runsPerMonth: plan.runsPerMonth,
    overageAllowed,
  };
}
