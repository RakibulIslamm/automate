import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { JsonBlock } from '@/components/runs/json-block';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import {
  RunStepCard,
  type RenderedStepResult,
} from '@/components/runs/run-step-card';
import { RunLiveUpdates } from '@/components/runs/run-live-updates';
import { RunNowButton } from '@/components/workflows/run-now-button';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Workflow, WorkflowRun } from '@/lib/db/models';

export const metadata: Metadata = { title: 'Run' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  const user = await requireUser();
  await connectDb();

  const run = await WorkflowRun.findOne({
    _id: new Types.ObjectId(id),
    userId: user._id,
  }).lean();
  if (!run) notFound();

  const workflow = await Workflow.findOne({ _id: run.workflowId })
    .select('name status')
    .lean();

  const workflowPausedReason =
    workflow?.status === 'paused'
      ? 'This workflow is paused. Resume it to run.'
      : workflow?.status === 'error'
        ? 'This workflow is in an error state. Fix it and resume to run.'
        : null;

  const stepResults = ((run.stepResults ?? []) as RenderedStepResult[]).map(
    serializeStepResult,
  );

  const triggerTimestamp = run.completedAt ?? run.startedAt ?? run.createdAt;

  return (
    <>
      <RunLiveUpdates runId={String(run._id)} initialStatus={run.status} />

      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/workflows/${String(run.workflowId)}`}>
            <ArrowLeft className="size-3.5" />
            Back to workflow
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={`Run · ${String(run._id).slice(-8)}`}
        title={workflow?.name ?? 'Run'}
        description={
          triggerTimestamp
            ? `${formatRelative(triggerTimestamp)} · ${format(new Date(triggerTimestamp), 'PPp')}`
            : 'Queued'
        }
        action={<RunStatusBadge status={run.status} />}
      />

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-4">
        <Stat label="Status" value={capitalize(run.status)} />
        <Stat
          label="Duration"
          value={run.durationMs != null ? formatDuration(run.durationMs) : '—'}
          mono
        />
        <Stat
          label="Cost"
          value={run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}
          mono
        />
        <Stat label="Steps" value={String(stepResults.length)} mono />
      </div>

      {run.errorMessage ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-2">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
              Run error
            </p>
          </div>
          <div className="px-5 py-4 font-mono text-[13px] text-rose-700 dark:text-rose-300">
            {run.errorMessage}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Steps — main column */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Execution
              </p>
              <h2 className="font-serif text-2xl tracking-tight">Steps</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {stepResults.length} step{stepResults.length === 1 ? '' : 's'}
            </span>
          </div>

          {stepResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 py-14 text-center text-sm text-muted-foreground">
              No steps executed.
            </div>
          ) : (
            <div className="space-y-3">
              {stepResults.map((step, i) => (
                <RunStepCard key={`${step.id}-${i}`} step={step} index={i + 1} />
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4">
            <div>
              <p className="text-sm font-medium">Re-run with same trigger data</p>
              <p className="text-xs text-muted-foreground">
                Useful for debugging a failure without waiting for the trigger again.
              </p>
            </div>
            <RunNowButton
              workflowId={String(run.workflowId)}
              label="Re-run"
              triggerData={run.triggerData}
              disabled={workflowPausedReason !== null}
              disabledReason={workflowPausedReason ?? undefined}
            />
          </div>
        </section>

        {/* Right rail */}
        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <header className="border-b border-border/60 px-5 py-3">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Trigger data
              </p>
            </header>
            <div className="p-3">
              <JsonBlock value={run.triggerData ?? {}} />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Timeline
            </p>
            <ul className="space-y-2.5 text-sm">
              <TimelineRow label="Queued" value={run.createdAt} />
              <TimelineRow label="Started" value={run.startedAt} />
              <TimelineRow label="Finished" value={run.completedAt} />
            </ul>
          </section>

          <Link
            href={`/dashboard/workflows/${String(run.workflowId)}`}
            className="group flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/30"
          >
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Workflow
              </p>
              <p className="mt-1 font-serif text-lg tracking-tight">
                {workflow?.name ?? '—'}
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </aside>
      </div>
    </>
  );
}

/* ───────────────────────────── helpers ───────────────────────────── */

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: Date | string | null | undefined }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value ? (
        <span className="text-right text-xs tabular-nums">
          <span className="block font-medium text-foreground">
            {format(new Date(value), 'p')}
          </span>
          <span className="text-muted-foreground">{format(new Date(value), 'PP')}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </li>
  );
}

function formatRelative(value: Date | string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function serializeStepResult(raw: unknown): RenderedStepResult {
  const r = raw as Partial<RenderedStepResult> & {
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
    branchResults?: unknown[];
  };
  return {
    id: r.id ?? '',
    type: r.type ?? '',
    status: (r.status as RenderedStepResult['status']) ?? 'success',
    resolvedConfig: r.resolvedConfig,
    output: r.output,
    error: r.error ?? null,
    costUsd: r.costUsd ?? null,
    durationMs: typeof r.durationMs === 'number' ? r.durationMs : 0,
    startedAt: toIso(r.startedAt),
    completedAt: toIso(r.completedAt),
    branchTaken: r.branchTaken,
    branchResults: Array.isArray(r.branchResults)
      ? r.branchResults.map(serializeStepResult)
      : undefined,
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}
