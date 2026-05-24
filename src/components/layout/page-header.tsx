import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Editorial page header. Optional small "eyebrow" sits above the title
 * (used for breadcrumbs or section labels). Headline is large serif;
 * description is muted and slightly indented under it. Actions float
 * right, baseline-aligned with the title on wider screens.
 */
export function PageHeader({ title, description, eyebrow, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
