'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CheckoutButtonProps {
  plan: 'starter' | 'pro' | 'business';
  label?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  className?: string;
}

/**
 * Hit `/api/stripe/checkout` and redirect to the Stripe-hosted checkout
 * URL. The redirect happens with `window.location.assign` (not `router.push`)
 * because the destination is a different origin.
 */
export function CheckoutButton({
  plan,
  label,
  variant = 'default',
  size = 'default',
  disabled,
  className,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const json = (await res.json()) as
          | { data?: { url?: string } }
          | { error?: { message?: string } };
        if ('data' in json && json.data?.url) {
          window.location.assign(json.data.url);
          return;
        }
        const msg =
          ('error' in json && json.error?.message) || 'Could not start checkout.';
        toast.error(msg);
        setBusy(false);
      } catch {
        toast.error('Network hiccup — try again.');
        setBusy(false);
      }
    });
    router.refresh();
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || busy || isPending}
      variant={variant}
      size={size}
      className={className}
    >
      {busy || isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label ?? `Upgrade to ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`}
    </Button>
  );
}
