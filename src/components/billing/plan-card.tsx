import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckoutButton } from './checkout-button';
import { PortalButton } from './portal-button';
import type { Plan } from '@/lib/db/models';
import { type PlanDefinition } from '@/lib/stripe/plans';

interface PlanCardProps {
  planKey: Plan;
  plan: PlanDefinition;
  isCurrent: boolean;
  hasSubscription: boolean;
}

/**
 * One plan in the comparison grid. The CTA changes by relationship:
 *   - Free + you're on free        → no button (you're already here)
 *   - Paid + you're on it          → "Manage subscription" → portal
 *   - Paid + you're elsewhere      → "Upgrade" or "Switch" → checkout/portal
 */
export function PlanCard({ planKey, plan, isCurrent, hasSubscription }: PlanCardProps) {
  const isPaid = planKey !== 'free';

  let cta: React.ReactNode = null;
  if (isCurrent && isPaid) {
    cta = <PortalButton label="Manage" />;
  } else if (isCurrent && !isPaid) {
    cta = (
      <p className="text-xs text-muted-foreground">You’re on this plan.</p>
    );
  } else if (isPaid) {
    if (hasSubscription) {
      cta = <PortalButton label="Switch plan" variant="default" />;
    } else {
      cta = <CheckoutButton plan={planKey as 'starter' | 'pro' | 'business'} label={`Upgrade to ${plan.name}`} />;
    }
  } else {
    // free + not current: only reachable by cancelling, so no button.
    cta = (
      <p className="text-xs text-muted-foreground">
        Cancel your subscription in the portal to drop back to Free.
      </p>
    );
  }

  return (
    <Card className={cn('flex flex-col', isCurrent && 'border-foreground/40 ring-1 ring-foreground/10')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-serif text-xl tracking-tight">{plan.name}</CardTitle>
          {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
        </div>
        <CardDescription>
          {plan.priceUsd === 0 ? 'Free forever' : <>
            <span className="text-foreground font-medium">${plan.priceUsd}</span>
            <span className="text-muted-foreground"> / month</span>
          </>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-6">
        <ul className="space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div>{cta}</div>
      </CardContent>
    </Card>
  );
}
