'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/states/error-state';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);

    // Best-effort report. The endpoint is wired to ErrorLog in Phase 3.
    if (typeof window !== 'undefined') {
      void fetch('/api/internal/log-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          source: 'error-boundary',
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          url: window.location.href,
          userAgent: window.navigator.userAgent,
        }),
      }).catch(() => {
        // Swallow — never let logging itself throw out of a boundary.
      });
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorState
          title="Something went wrong"
          description="An unexpected error occurred while rendering this page. Try refreshing — if the problem keeps happening, we&apos;ll get a report and fix it."
          action={
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          }
        />
      );
    }
    return this.props.children;
  }
}
