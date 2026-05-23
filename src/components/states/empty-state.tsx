import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        {icon ?? <Inbox className="h-8 w-8" aria-hidden />}
      </div>
      <h2 className="mt-6 font-serif text-2xl tracking-tight sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
