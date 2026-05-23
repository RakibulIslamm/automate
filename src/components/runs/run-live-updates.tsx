'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Poll `/api/runs/[id]` while the run is `queued` or `running`, then call
 * `router.refresh()` once it terminates so the server-rendered page shows
 * the final state. Lightweight on purpose — no SSE plumbing, no zustand.
 *
 * The polling interval is 2s. We stop polling on the first non-active
 * status so a stuck or completed run doesn't burn requests forever.
 */
export function RunLiveUpdates({
  runId,
  initialStatus,
}: {
  runId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== 'queued' && status !== 'running') return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { status?: string };
        };
        const next = json.data?.status;
        if (cancelled || !next) return;
        if (next !== status) {
          setStatus(next);
          // Server-component refresh: re-fetches the page on the server with
          // the new run data. Cheaper than rebuilding step-card state here.
          router.refresh();
        }
      } catch {
        // Network blip — try again on the next tick.
      }
    };

    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runId, status, router]);

  return null;
}
