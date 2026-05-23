'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/states/error-state';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    void fetch('/api/internal/log-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        source: 'route-error',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <ErrorState
        title="Something went wrong"
        description="We hit a snag rendering this page. The error has been reported — try again, or head back home."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Go home
            </Link>
          </div>
        }
      />
    </main>
  );
}
