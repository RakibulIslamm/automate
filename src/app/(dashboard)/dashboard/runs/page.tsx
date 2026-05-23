import type { Metadata } from 'next';
import Link from 'next/link';
import { History } from 'lucide-react';
import { Types } from 'mongoose';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { RunRow, type RunRowData } from '@/components/runs/run-row';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  Workflow,
  WorkflowRun,
  WORKFLOW_RUN_STATUSES,
  type WorkflowRunStatus,
} from '@/lib/db/models';

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
  { key: 'failure', label: 'Failure', statuses: ['failure', 'partial'] as const },
  { key: 'running', label: 'Running', statuses: ['running', 'queued'] as const },
];

export default async function RunsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const user = await requireUser();
  await connectDb();

  const query: Record<string, unknown> = { userId: user._id };
  if (active.statuses) {
    query.status = { $in: active.statuses };
  }

  const docs = await WorkflowRun.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Fetch the parent workflows in a single round-trip and stitch.
  const workflowIds = Array.from(
    new Set(docs.map((d) => String(d.workflowId))),
  ).map((id) => new Types.ObjectId(id));
  const workflows = workflowIds.length
    ? await Workflow.find({ _id: { $in: workflowIds } })
        .select('name')
        .lean()
    : [];
  const nameById = new Map(workflows.map((w) => [String(w._id), w.name]));

  const rows: RunRowData[] = docs.map((d) => ({
    id: String(d._id),
    workflowId: String(d.workflowId),
    workflowName: nameById.get(String(d.workflowId)) ?? '(deleted workflow)',
    status: (WORKFLOW_RUN_STATUSES.includes(d.status as WorkflowRunStatus)
      ? d.status
      : 'queued') as WorkflowRunStatus,
    createdAt: (d.createdAt instanceof Date
      ? d.createdAt
      : new Date()
    ).toISOString(),
    startedAt: d.startedAt ? new Date(d.startedAt).toISOString() : null,
    completedAt: d.completedAt ? new Date(d.completedAt).toISOString() : null,
    durationMs: typeof d.durationMs === 'number' ? d.durationMs : null,
    costUsd: typeof d.costUsd === 'number' ? d.costUsd : null,
  }));

  return (
    <>
      <PageHeader
        title="Runs"
        description="Every workflow execution, with step-by-step output and timing."
      />

      <Tabs value={active.key}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key} asChild>
              <Link href={f.key === 'all' ? '/dashboard/runs' : `/dashboard/runs?filter=${f.key}`}>
                {f.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={active.key} className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState
                icon={<History className="h-8 w-8" aria-hidden />}
                title={
                  active.key === 'all'
                    ? 'No runs yet'
                    : `No ${active.label.toLowerCase()} runs yet`
                }
                description={
                  active.key === 'all'
                    ? 'Once you create and trigger a workflow, its runs show up here.'
                    : "Try a different filter, or run a workflow to populate this list."
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
