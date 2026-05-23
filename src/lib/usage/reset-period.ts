import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';

export interface ResetUsagePeriodInput {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Zero out runsThisPeriod and stamp the new billing window. Invoked from
 * the Stripe webhook on `invoice.paid` — Stripe is authoritative for
 * when the period turned over, so we mirror its dates.
 */
export async function resetUsagePeriod({
  userId,
  periodStart,
  periodEnd,
}: ResetUsagePeriodInput): Promise<void> {
  await connectDb();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        'usage.runsThisPeriod': 0,
        'usage.periodStart': periodStart,
        'usage.periodEnd': periodEnd,
      },
    },
  );
}
