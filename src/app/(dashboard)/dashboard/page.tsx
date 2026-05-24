import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Plus, Plug } from 'lucide-react';
import { Types } from 'mongoose';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  Workflow,
  WorkflowRun,
  Integration,
  type WorkflowRunStatus,
} from '@/lib/db/models';
import { getPlan } from '@/lib/stripe/plans';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Overview' };

interface RecentRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  createdAt: Date;
  durationMs: number | null;
}

export default async function OverviewPage() {
  const user = await requireUser();
  await connectDb();

  const userId = user._id;
  const now = new Date();
  const periodStart = user.usage?.periodStart
    ? new Date(user.usage.periodStart)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  // Pull every count we need in parallel.
  const [
    workflowCounts,
    runAgg,
    runsThisMonth,
    integrationsCount,
    recentRunDocs,
  ] = await Promise.all([
    Workflow.aggregate<{ _id: string; n: number }>([
      { $match: { userId } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    WorkflowRun.aggregate<{ _id: WorkflowRunStatus; n: number }>([
      { $match: { userId, createdAt: { $gte: periodStart } } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    WorkflowRun.countDocuments({ userId, createdAt: { $gte: periodStart } }),
    Integration.countDocuments({ userId, status: 'active' }),
    WorkflowRun.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);

  const workflowStatusCounts = countsByKey(workflowCounts);
  const runStatusCounts = countsByKey(runAgg);
  const successCount = runStatusCounts.success ?? 0;
  const failureCount = runStatusCounts.failure ?? 0;
  const finishedCount = successCount + failureCount;
  const successRate = finishedCount === 0 ? null : (successCount / finishedCount) * 100;
  const activeWorkflows = workflowStatusCounts.active ?? 0;
  const totalWorkflows =
    (workflowStatusCounts.active ?? 0) +
    (workflowStatusCounts.paused ?? 0) +
    (workflowStatusCounts.error ?? 0);

  const plan = getPlan(user.plan ?? 'free');
  const usagePct = plan.runsPerMonth === 0
    ? 0
    : Math.min(100, (runsThisMonth / plan.runsPerMonth) * 100);

  // Map workflow names by id for the recent-runs table (one extra query
  // is fine; runsList is capped at 8).
  const workflowIds = Array.from(
    new Set(recentRunDocs.map((r) => String(r.workflowId))),
  ).map((id) => new Types.ObjectId(id));
  const workflowDocs = workflowIds.length > 0
    ? await Workflow.find({ _id: { $in: workflowIds }, userId }).select('name').lean()
    : [];
  const nameById = new Map(workflowDocs.map((w) => [String(w._id), w.name as string]));

  const recentRuns: RecentRun[] = recentRunDocs.map((r) => ({
    id: String(r._id),
    workflowId: String(r.workflowId),
    workflowName: nameById.get(String(r.workflowId)) ?? 'Workflow',
    status: (r.status as WorkflowRunStatus) ?? 'queued',
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(),
    durationMs: typeof r.durationMs === 'number' ? r.durationMs : null,
  }));

  const isEmpty = totalWorkflows === 0 && runsThisMonth === 0 && integrationsCount === 0;

  return (
    <>
      <PageHeader
        eyebrow={`Welcome back${user.name ? `, ${firstName(user.name)}` : ''}`}
        title="Overview"
        description="A snapshot of your workflows, runs, and how much of your plan you've used."
        action={
          <Button asChild size="sm">
            <Link href="/dashboard/workflows/new">
              <Plus className="size-3.5" aria-hidden />
              New workflow
            </Link>
          </Button>
        }
      />

      {/* Bento grid — varied tile sizes feel less like a generic CRM dashboard */}
      <section className="grid auto-rows-[minmax(0,160px)] grid-cols-1 gap-3 md:grid-cols-6">
        <Tile className="md:col-span-3 md:row-span-2">
          <StatLabel>This period</StatLabel>
          <p className="mt-2 font-serif text-6xl leading-none tracking-tight tabular-nums sm:text-7xl">
            {runsThisMonth.toLocaleString()}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            workflow runs since{' '}
            {periodStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
          <div className="mt-auto">
            <UsageBar pct={usagePct} runs={runsThisMonth} cap={plan.runsPerMonth} planName={plan.name} />
          </div>
        </Tile>

        <Tile className="md:col-span-3">
          <StatLabel>Active workflows</StatLabel>
          <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums">
            {activeWorkflows}
            <span className="ml-2 text-sm text-muted-foreground">/ {totalWorkflows}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {totalWorkflows === 0
              ? 'No workflows yet.'
              : `${workflowStatusCounts.paused ?? 0} paused, ${workflowStatusCounts.error ?? 0} errored`}
          </p>
        </Tile>

        <Tile className="md:col-span-2">
          <StatLabel>Success rate</StatLabel>
          <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums">
            {successRate === null ? '—' : `${Math.round(successRate)}%`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {finishedCount === 0
              ? 'No completed runs yet.'
              : `${successCount} succeeded · ${failureCount} failed`}
          </p>
        </Tile>

        <Tile className="md:col-span-1">
          <StatLabel>Integrations</StatLabel>
          <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums">
            {integrationsCount}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {integrationsCount === 0 ? 'None connected' : 'connected'}
          </p>
        </Tile>
      </section>

      {/* Empty-state hero or recent activity table */}
      <section className="mt-12">
        {isEmpty ? (
          <FirstRunCard />
        ) : (
          <RecentActivity runs={recentRuns} />
        )}
      </section>
    </>
  );
}

/* ────────────────────────── pieces ────────────────────────── */

function countsByKey<K extends string>(
  rows: Array<{ _id: K; n: number }>,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const row of rows) out[row._id] = row.n;
  return out;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </p>
  );
}

function UsageBar({
  pct,
  runs,
  cap,
  planName,
}: {
  pct: number;
  runs: number;
  cap: number;
  planName: string;
}) {
  const over = runs > cap;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          {planName} plan · {cap.toLocaleString()} included
        </span>
        <span className="font-mono">{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            over ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-foreground',
          )}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function FirstRunCard() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center sm:p-12">
      <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden />
        Two minutes to first run
      </p>
      <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
        Let's get your first workflow running.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Connect at least one tool (Gmail, Slack, Notion…) and describe a workflow in plain English.
        AutoMate builds the structure for you.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard/integrations">
            <Plug className="size-3.5" aria-hidden />
            Connect a tool
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/workflows/new">
            <Plus className="size-3.5" aria-hidden />
            Or describe one now
          </Link>
        </Button>
      </div>
    </div>
  );
}

function RecentActivity({ runs }: { runs: RecentRun[] }) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Recent activity
          </p>
          <h2 className="mt-1 font-serif text-2xl tracking-tight">Latest runs</h2>
        </div>
        <Link
          href="/dashboard/runs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No runs yet this period.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {runs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/runs/${r.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.workflowName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {r.id.slice(0, 8)}…
                  </p>
                </div>
                <RunStatusBadge status={r.status} />
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                  {r.durationMs != null ? formatDuration(r.durationMs) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}
