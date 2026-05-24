import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PLAN_CONFIG } from '@/lib/stripe/plans';
import type { Plan } from '@/lib/db/models';

const ORDER: Plan[] = ['free', 'starter', 'pro', 'business'];
const HIGHLIGHT: Plan = 'starter';

interface PricingTeaserProps {
  isSignedIn?: boolean;
}

/**
 * Pricing teaser mirrors the dashboard/billing page cards but with
 * cleaner marketing copy and a strong CTA. The highlighted "Starter"
 * plan signals the recommended path without forcing a decision.
 *
 * For signed-in visitors the CTAs deep-link into the billing page where
 * actual upgrade flows live, instead of sending them through sign-up
 * again.
 */
export function PricingTeaser({ isSignedIn = false }: PricingTeaserProps) {
  const ctaHref = isSignedIn ? '/dashboard/billing' : '/sign-up';
  const freeCtaHref = isSignedIn ? '/dashboard' : '/sign-up';
  return (
    <section id="pricing" className="border-y border-border/60 bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade when you outgrow it. Cancel anytime.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((key) => {
            const plan = PLAN_CONFIG[key];
            const highlighted = key === HIGHLIGHT;
            return (
              <div
                key={key}
                className={cn(
                  'flex flex-col rounded-2xl border bg-background p-6',
                  highlighted
                    ? 'border-foreground/60 ring-1 ring-foreground/10 shadow-sm'
                    : 'border-border/60',
                )}
              >
                <p className="font-serif text-xl tracking-tight">{plan.name}</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-medium tabular-nums">
                    ${plan.priceUsd}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Button asChild className="w-full" variant={highlighted ? 'default' : 'outline'}>
                    <Link href={key === 'free' ? freeCtaHref : ctaHref}>
                      {ctaLabel(key, plan.name, isSignedIn)}
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Compare all features →
          </Link>
        </div>
      </div>
    </section>
  );
}

function ctaLabel(key: Plan, name: string, isSignedIn: boolean): string {
  if (key === 'free') return isSignedIn ? 'Open dashboard' : 'Start free';
  return isSignedIn ? `Upgrade to ${name}` : `Choose ${name}`;
}
