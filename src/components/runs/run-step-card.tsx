'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { StepType } from '@/lib/workflows/dsl';
import { STEP_META } from '@/components/workflows/step-meta';
import { JsonBlock } from './json-block';

export interface RenderedStepResult {
  id: string;
  type: string;
  status: 'success' | 'failure' | 'skipped';
  resolvedConfig?: unknown;
  output?: unknown;
  error?: { code: string; message: string } | null;
  costUsd?: number | null;
  durationMs: number;
  startedAt: string | null;
  completedAt: string | null;
  branchTaken?: 'then' | 'else' | 'none';
  branchResults?: RenderedStepResult[];
}

const STATUS_STYLES: Record<RenderedStepResult['status'], string> = {
  success: 'border-l-emerald-500/70',
  failure: 'border-l-rose-500/70',
  skipped: 'border-l-zinc-400/50',
};

interface Props {
  step: RenderedStepResult;
  /** 1-indexed visual position in the run; for branches starts again at 1. */
  index: number;
  /** Nested-branch depth; bumps the left padding so children indent. */
  depth?: number;
}

export function RunStepCard({ step, index, depth = 0 }: Props) {
  const [open, setOpen] = useState(step.status !== 'success');
  const meta = STEP_META[step.type as StepType];
  const Icon = meta?.icon ?? (() => null);

  return (
    <div
      className={cn(
        'rounded-r-xl border border-l-[3px] bg-card shadow-sm',
        STATUS_STYLES[step.status],
      )}
      style={{ marginLeft: depth * 16 }}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <div
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-border',
                meta?.accent ?? 'bg-muted',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  Step {index}
                </span>
                <span className="text-[11px] text-muted-foreground/60">·</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground/70">
                  {step.id}
                </span>
                <StatusPill status={step.status} />
                {step.branchTaken ? (
                  <Badge variant="outline" className="font-normal">
                    branch: {step.branchTaken}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 font-medium leading-tight">{meta?.label ?? step.type}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="tabular-nums">{formatDuration(step.durationMs)}</span>
              {step.costUsd != null ? (
                <span className="tabular-nums">${step.costUsd.toFixed(4)}</span>
              ) : null}
            </div>
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground"
              aria-hidden
            >
              <ChevronDown
                className={cn('size-4 transition-transform', open && 'rotate-180')}
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-border px-4 py-4">
            {step.error ? (
              <Section title="Error" tone="error">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                  {step.error.code}
                </p>
                <p className="text-sm">{step.error.message}</p>
              </Section>
            ) : null}

            {step.resolvedConfig !== undefined && step.resolvedConfig !== null ? (
              <Section title="Resolved config">
                <JsonBlock value={step.resolvedConfig} />
              </Section>
            ) : null}

            {step.output !== undefined && step.output !== null ? (
              <Section title="Output">
                <JsonBlock value={step.output} />
              </Section>
            ) : null}

            {step.branchResults && step.branchResults.length > 0 ? (
              <Section title="Branch steps">
                <div className="space-y-3">
                  {step.branchResults.map((child, i) => (
                    <RunStepCard
                      key={child.id}
                      step={child}
                      index={i + 1}
                      depth={depth + 1}
                    />
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StatusPill({ status }: { status: RenderedStepResult['status'] }) {
  const meta = {
    success: { label: 'Success', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
    failure: { label: 'Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
    skipped: { label: 'Skipped', cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  }[status];
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase', meta.cls)}>
      {meta.label}
    </span>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'error';
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          'text-xs uppercase tracking-wide',
          tone === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
        )}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
