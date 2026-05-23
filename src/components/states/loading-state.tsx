import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="loading-dot h-2 w-2 rounded-full bg-foreground/70 [animation-delay:-0.32s]" />
        <span className="loading-dot h-2 w-2 rounded-full bg-foreground/70 [animation-delay:-0.16s]" />
        <span className="loading-dot h-2 w-2 rounded-full bg-foreground/70" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{message ?? 'Loading…'}</p>
    </div>
  );
}
