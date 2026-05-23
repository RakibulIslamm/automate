import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
