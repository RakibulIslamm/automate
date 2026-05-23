import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { JsonBlock } from '@/components/runs/json-block';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import {
  RunStepCard,
  type RenderedStepResult,
} from '@/components/runs/run-step-card';
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
    .select('name')
    .lean();

  const stepResults = ((run.stepResults ?? []) as RenderedStepResult[]).map(
    serializeStepResult,
  );

  return (
    <>
      <PageHeader
        title={workflow?.name ?? 'Run'}
        description={
          run.completedAt
            ? `Ran on ${format(new Date(run.completedAt), 'PP p')}`
            : run.startedAt
              ? `Started on ${format(new Date(run.startedAt), 'PP p')}`
              : 'Queued'
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/workflows/${String(run.workflowId)}`}>
                <ArrowLeft className="size-3.5" />
                Back to workflow
              </Link>
            </Button>
            <RunStatusBadge status={run.status} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Status" value={capitalize(run.status)} />
        <Stat
          label="Duration"
          value={run.durationMs != null ? formatDuration(run.durationMs) : '—'}
        />
        <Stat
          label="Cost"
          value={run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}
        />
        <Stat label="Steps" value={String(stepResults.length)} />
      </div>

      {run.errorMessage ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-600">Run error</p>
            <p className="text-sm">{run.errorMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Trigger data
          </p>
          <JsonBlock value={run.triggerData ?? {}} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-xl tracking-tight">Steps</h2>
          {stepResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No steps executed.
            </p>
          ) : (
            <div className="space-y-3">
              {stepResults.map((step, i) => (
                <RunStepCard key={`${step.id}-${i}`} step={step} index={i + 1} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <RunNowButton
          workflowId={String(run.workflowId)}
          label="Re-run with same data"
          triggerData={run.triggerData}
        />
      </div>
    </>
  );
}

/* ───────────────────────────── helpers ───────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
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

/**
 * Mongoose lean returns Dates; the client component prop type expects
 * ISO strings (so it stays serialisable across the RSC boundary).
 */
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
