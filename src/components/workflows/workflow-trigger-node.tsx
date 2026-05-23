'use client';

import { cn } from '@/lib/utils';
import type { Trigger } from '@/lib/workflows/dsl';
import { TRIGGER_META, summarizeTrigger } from './step-meta';

interface Props {
  trigger: Trigger;
  className?: string;
}

export function WorkflowTriggerNode({ trigger, className }: Props) {
  const meta = TRIGGER_META[trigger.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'relative w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-border',
            meta.accent,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Trigger
          </span>
          <h3 className="mt-0.5 font-medium leading-tight">{meta.label}</h3>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {summarizeTrigger(trigger)}
          </p>
        </div>
      </div>
    </div>
  );
}
