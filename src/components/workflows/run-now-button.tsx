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
        | { error: { code?: string; message: string } };
      if (!res.ok || 'error' in payload) {
        const err = 'error' in payload ? payload.error : { code: undefined, message: 'Failed to start the run.' };
        if (err.code === 'QUOTA_EXCEEDED') {
          // Quota exceeded → pop the upgrade modal alongside the toast.
          toast.error(err.message, {
            action: {
              label: 'Upgrade',
              onClick: () =>
                window.dispatchEvent(new CustomEvent('automate:show-upgrade-modal')),
            },
          });
        } else if (err.code === 'BYOK_KEY_REQUIRED') {
          // BYOK gate → offer a one-click jump to the BYOK page.
          toast.error(err.message, {
            action: {
              label: 'Add a key',
              onClick: () => router.push('/dashboard/byok'),
            },
          });
        } else {
          toast.error(err.message);
        }
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
