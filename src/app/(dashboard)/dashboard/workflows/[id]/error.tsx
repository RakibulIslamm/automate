'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/states/error-state';

export default function WorkflowDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    void fetch('/api/internal/log-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        source: 'workflow-detail-error',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <ErrorState
      title="Couldn't load this workflow"
      description="Something went wrong fetching the workflow. Try again, or head back to the list."
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={unstable_retry}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/workflows">Back to workflows</Link>
          </Button>
        </div>
      }
    />
  );
}
