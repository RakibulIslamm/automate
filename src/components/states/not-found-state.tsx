import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotFoundStateProps {
  resource?: string;
  className?: string;
}

export function NotFoundState({ resource = 'Page', className }: NotFoundStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <MapPin className="h-8 w-8" aria-hidden />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">404</p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{resource} not found</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
        We couldn&apos;t find what you were looking for. Try one of the links below.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
