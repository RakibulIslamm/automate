'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * "Manage subscription" — opens the Stripe-hosted customer portal.
 * Same pattern as the checkout button (POST → URL → window.assign).
 */
export function PortalButton({
  label = 'Manage subscription',
  variant = 'outline',
}: {
  label?: string;
  variant?: 'default' | 'outline' | 'secondary';
}) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const json = (await res.json()) as
          | { data?: { url?: string } }
          | { error?: { message?: string } };
        if ('data' in json && json.data?.url) {
          window.location.assign(json.data.url);
          return;
        }
        const msg =
          ('error' in json && json.error?.message) || 'Could not open billing portal.';
        toast.error(msg);
        setBusy(false);
      } catch {
        toast.error('Network hiccup — try again.');
        setBusy(false);
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={busy || isPending} variant={variant} size="sm">
      {busy || isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label}
    </Button>
  );
}
