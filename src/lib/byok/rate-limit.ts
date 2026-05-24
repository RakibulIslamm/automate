import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';
import { env } from '@/lib/env';

/**
 * Daily AI-call cap per user when the platform fallback key is being used
 * in BYOK demo mode. Stops a single visitor from draining the demo budget.
 *
 * Stored as `{ usage.byokDemoAiCallsToday, usage.byokDemoAiDayStamp }` on
 * the User doc — same pattern as the runsThisPeriod counter, so we don't
 * introduce a separate collection or Redis dep.
 *
 * Day rollover: when `today !== byokDemoAiDayStamp`, reset to 0. No cron
 * needed — the next call advances the stamp.
 */

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  cap: number;
  remaining: number;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
}

/**
 * Atomic "check and bump" — returns the resulting state. Use BEFORE making
 * the AI call so an over-quota user is blocked, not just billed.
 */
export async function reserveDemoAiCall(userId: string): Promise<RateLimitResult> {
  const cap = env.BYOK_DAILY_LIMIT;
  if (cap === 0) {
    return { allowed: true, used: 0, cap: 0, remaining: Number.POSITIVE_INFINITY };
  }

  await connectDb();
  const today = todayStamp();
  const _id = new Types.ObjectId(userId);

  // Read current state first to decide whether to reset or increment.
  const current = await User.findById(_id)
    .select('usage.byokDemoAiCallsToday usage.byokDemoAiDayStamp')
    .lean();
  const stamp = (current?.usage as { byokDemoAiDayStamp?: string } | undefined)?.byokDemoAiDayStamp;
  const stale = stamp !== today;
  const used = stale
    ? 0
    : (current?.usage as { byokDemoAiCallsToday?: number } | undefined)?.byokDemoAiCallsToday ?? 0;

  if (used >= cap) {
    return { allowed: false, used, cap, remaining: 0 };
  }

  await User.updateOne(
    { _id },
    stale
      ? {
          $set: {
            'usage.byokDemoAiCallsToday': 1,
            'usage.byokDemoAiDayStamp': today,
          },
        }
      : { $inc: { 'usage.byokDemoAiCallsToday': 1 } },
  );

  return { allowed: true, used: used + 1, cap, remaining: cap - used - 1 };
}
