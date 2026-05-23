'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Props {
  workflowId: string;
  /** Disable the button when known-broken integrations would short-circuit. */
  disabled?: boolean;
  disabledReason?: string;
  /** Override label for re-running an existing run. */
  label?: string;
  /** Optional trigger data to send (e.g. re-running with same data). */
  triggerData?: unknown;
}

/**
 * "Run now" — POSTs to `/api/workflows/{id}/run`, redirects to the new
 * Run detail page. Inline execution today, so the API may take several
 * seconds to respond; we show a spinner the whole time.
 */
export function RunNowButton({
  workflowId,
  disabled,
  disabledReason,
  label = 'Run now',
  triggerData,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (disabled) {
      if (disabledReason) toast.error(disabledReason);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerData: triggerData ?? {} }),
      });
      const payload = (await res.json()) as
        | { data: { runId: string } }
        | { error: { message: string } };
      if (!res.ok || 'error' in payload) {
        const msg = 'error' in payload ? payload.error.message : 'Failed to start the run.';
        toast.error(msg);
        return;
      }
      router.push(`/dashboard/runs/${payload.data.runId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start the run.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending || disabled}
      title={disabled ? disabledReason : undefined}
      variant={label === 'Run now' ? 'default' : 'outline'}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Running…
        </>
      ) : (
        <>
          <Play className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}
