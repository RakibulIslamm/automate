'use client';

import { useEffect } from 'react';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    void fetch('/api/internal/log-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        source: 'global-error',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="dark min-h-full bg-background text-foreground font-sans">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="text-center">
            <div className="mx-auto inline-flex rounded-full bg-destructive/10 p-4 text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="mt-6 font-serif text-3xl tracking-tight sm:text-4xl">
              Something went wrong
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base mx-auto">
              A critical error occurred. The error has been reported — try refreshing or head back home.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Go home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
