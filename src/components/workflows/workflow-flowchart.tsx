'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Step, WorkflowDefinition } from '@/lib/workflows/dsl';
import { WorkflowTriggerNode } from './workflow-trigger-node';
import { WorkflowStepNode } from './workflow-step-node';

interface Props {
  definition: WorkflowDefinition;
  onEditStep?: (step: Step) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Top-down flowchart visualization of a workflow. Each node sits in its own
 * row, connected by a vertical line drawn with simple CSS — no SVG mess,
 * no ReactFlow dependency. `condition.if` steps render the parent node with
 * two indented sub-columns ("then" / "else") side by side on desktop,
 * stacked vertically on mobile.
 */
export function WorkflowFlowchart({ definition, onEditStep, readOnly, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-0', className)}>
      <Row>
        <WorkflowTriggerNode trigger={definition.trigger} />
      </Row>

      {definition.steps.length === 0 ? (
        <EmptyHint />
      ) : (
        renderSteps(definition.steps, { onEditStep, readOnly, depth: 0 })
      )}
    </div>
  );
}

interface RenderCtx {
  onEditStep?: (step: Step) => void;
  readOnly?: boolean;
  depth: number;
}

function renderSteps(steps: Step[], ctx: RenderCtx): ReactNode {
  return steps.map((step, i) => (
    <Fragment key={step.id}>
      <Connector />
      {step.type === 'condition.if' ? (
        <ConditionRow step={step} ctx={ctx} index={i} />
      ) : (
        <Row>
          <WorkflowStepNode
            step={step}
            index={i + ctx.depth * 100}
            onEdit={ctx.onEditStep}
            readOnly={ctx.readOnly}
          />
        </Row>
      )}
    </Fragment>
  ));
}

function ConditionRow({
  step,
  ctx,
  index,
}: {
  step: Extract<Step, { type: 'condition.if' }>;
  ctx: RenderCtx;
  index: number;
}): ReactNode {
  return (
    <>
      <Row>
        <WorkflowStepNode
          step={step}
          index={index + ctx.depth * 100}
          onEdit={ctx.onEditStep}
          readOnly={ctx.readOnly}
        />
      </Row>
      <Connector />
      <div className="grid w-full max-w-3xl grid-cols-1 gap-6 px-4 sm:grid-cols-2">
        <BranchColumn label="If true" steps={step.config.then} ctx={ctx} accent="emerald" />
        <BranchColumn
          label="Otherwise"
          steps={step.config.else ?? []}
          ctx={ctx}
          accent="rose"
        />
      </div>
    </>
  );
}

function BranchColumn({
  label,
  steps,
  ctx,
  accent,
}: {
  label: string;
  steps: Step[];
  ctx: RenderCtx;
  accent: 'emerald' | 'rose';
}): ReactNode {
  const tone =
    accent === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20'
      : 'border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20';

  return (
    <div className={cn('flex flex-col items-center rounded-xl border-2 border-dashed p-3', tone)}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {steps.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">— do nothing —</p>
      ) : (
        renderSteps(steps, { ...ctx, depth: ctx.depth + 1 })
      )}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex w-full justify-center">{children}</div>;
}

function Connector() {
  return (
    <div className="my-1 h-6 w-px shrink-0 bg-border" aria-hidden />
  );
}

function EmptyHint() {
  return (
    <>
      <Connector />
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
        This workflow has no steps yet. The AI couldn't find a way to express
        your request with the integrations you've connected — try connecting
        the missing tool or rephrasing the prompt.
      </div>
    </>
  );
}
