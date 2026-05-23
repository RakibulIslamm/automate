'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckoutButton } from './checkout-button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_CONFIG } from '@/lib/stripe/plans';
import type { Plan } from '@/lib/db/models';

/**
 * Listens for a global `automate:show-upgrade-modal` CustomEvent and pops
 * a comparison dialog. Trigger it from anywhere with:
 *
 *   window.dispatchEvent(new CustomEvent('automate:show-upgrade-modal'))
 *
 * Useful from the quota-exceeded toast — the toast can fire the event
 * and we get a richer pricing view than a single CTA.
 */
export function UpgradeModal({ currentPlan }: { currentPlan: Plan }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('automate:show-upgrade-modal', handler);
    return () => window.removeEventListener('automate:show-upgrade-modal', handler);
  }, []);

  const paidPlans: Array<{ key: 'starter' | 'pro' | 'business' }> = [
    { key: 'starter' },
    { key: 'pro' },
    { key: 'business' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl tracking-tight">Upgrade your plan</DialogTitle>
          <DialogDescription>
            Pick a plan that fits how often your workflows run. You can switch or cancel any time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {paidPlans.map(({ key }) => {
            const plan = PLAN_CONFIG[key];
            const isCurrent = currentPlan === key;
            return (
              <div
                key={key}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-4',
                  isCurrent && 'border-foreground/40 ring-1 ring-foreground/10',
                )}
              >
                <div>
                  <p className="font-serif text-lg tracking-tight">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">${plan.priceUsd} / month</p>
                </div>
                <ul className="flex-1 space-y-1.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {!isCurrent ? (
                  <CheckoutButton plan={key} label={`Go ${plan.name}`} />
                ) : (
                  <p className="text-xs text-muted-foreground">You’re on this plan.</p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
