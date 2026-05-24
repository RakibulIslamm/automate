import type { Metadata } from 'next';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Types } from 'mongoose';
import { History, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  Workflow,
  WorkflowRun,
  WORKFLOW_RUN_STATUSES,
  type WorkflowRunStatus,
} from '@/lib/db/models';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Runs' };

interface SearchParams {
  filter?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const FILTERS = [
  { key: 'all', label: 'All', statuses: null as readonly WorkflowRunStatus[] | null },
  { key: 'success', label: 'Success', statuses: ['success'] as const },
  { key: 'failure', label: 'Failed', statuses: ['failure', 'partial'] as const },
  { key: 'running', label: 'In flight', statuses: ['running', 'queued'] as const },
];

interface Row {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  createdAt: Date;
  durationMs: number | null;
  costUsd: number | null;
}

export default async function RunsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;

  const user = await requireUser();
  await connectDb();

  const query: Record<string, unknown> = { userId: user._id };
  if (active.statuses) query.status = { $in: active.statuses };

  // Get filter counts in parallel for the tab labels.
  const [docs, countsRaw] = await Promise.all([
    WorkflowRun.find(query).sort({ createdAt: -1 }).limit(100).lean(),
    WorkflowRun.aggregate<{ _id: WorkflowRunStatus; n: number }>([
      { $match: { userId: user._id } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ]);

  const counts = new Map(countsRaw.map((c) => [c._id, c.n]));
  const filterCounts: Record<string, number> = {
    all: countsRaw.reduce((sum, c) => sum + c.n, 0),
    success: counts.get('success') ?? 0,
    failure: (counts.get('failure') ?? 0) + (counts.get('partial') ?? 0),
    running: (counts.get('running') ?? 0) + (counts.get('queued') ?? 0),
  };

  const workflowIds = Array.from(
    new Set(docs.map((d) => String(d.workflowId))),
  ).map((id) => new Types.ObjectId(id));
  const workflows = workflowIds.length
    ? await Workflow.find({ _id: { $in: workflowIds } }).select('name').lean()
    : [];
  const nameById = new Map(workflows.map((w) => [String(w._id), w.name as string]));

  const rows: Row[] = docs.map((d) => ({
    id: String(d._id),
    workflowId: String(d.workflowId),
    workflowName: nameById.get(String(d.workflowId)) ?? '(deleted workflow)',
    status: (WORKFLOW_RUN_STATUSES.includes(d.status as WorkflowRunStatus)
      ? d.status
      : 'queued') as WorkflowRunStatus,
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(),
    durationMs: typeof d.durationMs === 'number' ? d.durationMs : null,
    costUsd: typeof d.costUsd === 'number' ? d.costUsd : null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Runs"
        description="Every workflow execution, with step output, timing, and the cost it incurred."
      />

      {/* Filter rail — compact pill row instead of standard tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const isActive = f.key === active.key;
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/dashboard/runs' : `/dashboard/runs?filter=${f.key}`}
              className={cn(
                'group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span
                className={cn(
                  'inline-flex min-w-6 justify-center rounded-full px-1.5 text-[10px] font-mono tabular-nums',
                  isActive
                    ? 'bg-background/15 text-background'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {filterCounts[f.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyRuns label={active.label.toLowerCase()} isAll={active.key === 'all'} />
      ) : (
        <RunsTable rows={rows} />
      )}
    </>
  );
}

function EmptyRuns({ label, isAll }: { label: string; isAll: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center sm:p-14">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-foreground">
        <History className="size-5" aria-hidden />
      </div>
      <h2 className="font-serif text-2xl tracking-tight">
        {isAll ? 'No runs yet' : `No ${label} runs`}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {isAll
          ? 'Once a workflow runs, every execution shows up here with full step output.'
          : 'Try a different filter, or trigger a workflow to populate this list.'}
      </p>
    </div>
  );
}

function RunsTable({ rows }: { rows: Row[] }) {
  // Group rows by date for a calmer, more editorial scan pattern.
  const groups = groupByDay(rows);
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {group.rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/runs/${r.id}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_1fr_auto_auto_auto_auto]"
                >
                  <RunStatusBadge status={r.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.workflowName}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {r.id.slice(0, 10)}…
                    </p>
                  </div>
                  <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                    {r.durationMs != null ? formatDuration(r.durationMs) : '—'}
                  </span>
                  <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                    {r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : '—'}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {format(r.createdAt, 'h:mm a')}
                  </span>
                  <ArrowRight
                    className="size-3.5 justify-self-end text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByDay(rows: Row[]): Array<{ label: string; rows: Row[] }> {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const start = startOfDay(r.createdAt).getTime();
    let label: string;
    if (start === today) label = 'Today';
    else if (start === yesterday) label = 'Yesterday';
    else label = formatDistanceToNow(r.createdAt, { addSuffix: true });
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(r);
  }
  return Array.from(buckets.entries()).map(([label, rows]) => ({ label, rows }));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}
