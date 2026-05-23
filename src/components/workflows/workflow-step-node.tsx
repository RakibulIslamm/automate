'use client';

import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Step } from '@/lib/workflows/dsl';
import { STEP_META, summarizeStep } from './step-meta';

interface Props {
  step: Step;
  index: number;
  onEdit?: (step: Step) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * One step rendered as a card in the workflow flowchart. Reused for both
 * the AI-builder review state and the workflow detail page's Definition
 * tab (with `readOnly` enabled).
 */
export function WorkflowStepNode({ step, index, onEdit, readOnly, className }: Props) {
  const meta = STEP_META[step.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'group relative w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-border',
            meta.accent,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Step {index + 1}
            </span>
            <span className="text-[11px] text-muted-foreground/60">·</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground/70">
              {step.id}
            </span>
          </div>
          <h3 className="mt-0.5 font-medium leading-tight">{meta.label}</h3>
          <p
            className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground"
            title={summarizeStep(step)}
          >
            {summarizeStep(step)}
          </p>
        </div>
        {!readOnly && onEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onEdit(step)}
            aria-label={`Edit step ${index + 1}`}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
