import { env } from '@/lib/env';
import type { Plan } from '@/lib/db/models';

/**
 * Single source of truth for plan definitions — quota checks, billing page,
 * upgrade modal, and the executor all read from here. Keeps the numbers
 * consistent between gate code and UI labels.
 */

export interface PlanDefinition {
  name: string;
  priceUsd: number;
  runsPerMonth: number;
  maxWorkflows: number | null;
  /** USD per run after included quota runs out. `null` = no overage allowed. */
  overageRateUsd: number | null;
  priceId: string | null;
  overagePriceId: string | null;
  features: string[];
}

export const PLAN_CONFIG: Record<Plan, PlanDefinition> = {
  free: {
    name: 'Free',
    priceUsd: 0,
    runsPerMonth: 50,
    maxWorkflows: 3,
    overageRateUsd: null,
    priceId: null,
    overagePriceId: null,
    features: [
      '50 workflow runs / month',
      'Up to 3 workflows',
      'All integrations',
      'AI workflow builder',
    ],
  },
  starter: {
    name: 'Starter',
    priceUsd: 19,
    runsPerMonth: 1000,
    maxWorkflows: 20,
    overageRateUsd: 0.05,
    priceId: env.STRIPE_STARTER_PRICE_ID ?? null,
    overagePriceId: env.STRIPE_STARTER_OVERAGE_PRICE_ID ?? null,
    features: [
      '1,000 runs / month included',
      '$0.05 / run after that',
      'Up to 20 workflows',
      'Priority support',
    ],
  },
  pro: {
    name: 'Pro',
    priceUsd: 49,
    runsPerMonth: 5000,
    maxWorkflows: 100,
    overageRateUsd: 0.04,
    priceId: env.STRIPE_PRO_PRICE_ID ?? null,
    overagePriceId: env.STRIPE_PRO_OVERAGE_PRICE_ID ?? null,
    features: [
      '5,000 runs / month included',
      '$0.04 / run after that',
      'Up to 100 workflows',
      'Priority support + roadmap input',
    ],
  },
  business: {
    name: 'Business',
    priceUsd: 149,
    runsPerMonth: 20_000,
    maxWorkflows: null,
    overageRateUsd: 0.03,
    priceId: env.STRIPE_BUSINESS_PRICE_ID ?? null,
    overagePriceId: env.STRIPE_BUSINESS_OVERAGE_PRICE_ID ?? null,
    features: [
      '20,000 runs / month included',
      '$0.03 / run after that',
      'Unlimited workflows',
      'SSO + dedicated Slack',
    ],
  },
};

export function getPlan(plan: Plan): PlanDefinition {
  return PLAN_CONFIG[plan];
}

/**
 * Reverse lookup: given a Stripe price id, return the plan it belongs to.
 * Used by the webhook to map subscription updates back to our enum.
 * Returns null on a price we don't recognise (overage lines, etc).
 */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const [plan, def] of Object.entries(PLAN_CONFIG) as [Plan, PlanDefinition][]) {
    if (def.priceId === priceId) return plan;
  }
  return null;
}
