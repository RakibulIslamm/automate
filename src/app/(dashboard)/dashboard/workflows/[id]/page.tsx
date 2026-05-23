import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Pencil,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  Integration,
  Workflow,
  WorkflowRun,
  WORKFLOW_RUN_STATUSES,
  type IntegrationStatus,
  type WorkflowStatus,
  type WorkflowRunStatus,
} from '@/lib/db/models';
import { workflowDefinitionSchema, type WorkflowDefinition } from '@/lib/workflows/dsl';
import { WorkflowFlowchart } from '@/components/workflows/workflow-flowchart';
import { WorkflowSettingsActions } from '@/components/workflows/workflow-settings-actions';
import { RunNowButton } from '@/components/workflows/run-now-button';
import { RunRow, type RunRowData } from '@/components/runs/run-row';

export const metadata: Metadata = { title: 'Workflow' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailPage({ params }: Props) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  const user = await requireUser();
  await connectDb();
  const doc = await Workflow.findOne({ _id: new Types.ObjectId(id), userId: user._id }).lean();
  if (!doc) notFound();

  // The Mongoose schema stores `definition` as Mixed, so re-validate before
  // handing it to the flowchart — keeps a corrupt DB row from crashing the
  // page (it just renders an empty flow with a helpful hint).
  const defResult = workflowDefinitionSchema.safeParse(doc.definition);
  const definition: WorkflowDefinition | null = defResult.success ? defResult.data : null;

  const status = doc.status as WorkflowStatus;

  // Run-now eligibility: every integration referenced by the workflow must
  // be currently active. We only block when we can prove a problem; missing
  // detection still lets the user click through and see the executor's
  // friendly failure message.
  const blockReason = definition
    ? await checkIntegrationsHealthy(definition, String(user._id))
    : null;

  // Fetch this workflow's runs for the Runs tab.
  const runDocs = await WorkflowRun.find({ workflowId: doc._id, userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const runs: RunRowData[] = runDocs.map((r) => ({
    id: String(r._id),
    workflowId: String(r.workflowId),
    workflowName: doc.name,
    status: (WORKFLOW_RUN_STATUSES.includes(r.status as WorkflowRunStatus)
      ? r.status
      : 'queued') as WorkflowRunStatus,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date()).toISOString(),
    startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
    completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    durationMs: typeof r.durationMs === 'number' ? r.durationMs : null,
    costUsd: typeof r.costUsd === 'number' ? r.costUsd : null,
  }));

  return (
    <>
      <PageHeader
        title={doc.name}
        description={doc.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <RunNowButton
              workflowId={String(doc._id)}
              disabled={blockReason !== null}
              disabledReason={blockReason ?? undefined}
            />
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4 sm:max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="definition">Definition</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Total runs" value={String(doc.runCount ?? 0)} />
            <Stat
              label="Last run"
              value={
                doc.lastRunAt
                  ? formatDistanceToNow(new Date(doc.lastRunAt), { addSuffix: true })
                  : '—'
              }
            />
            <Stat
              label="Last result"
              value={doc.lastRunStatus ? capitalize(doc.lastRunStatus) : '—'}
            />
          </div>

          {doc.originalPrompt ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg tracking-tight">
                  Original prompt
                </CardTitle>
                <CardDescription>What you originally typed.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                  “{doc.originalPrompt}”
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="definition" className="mt-6 space-y-4">
          <div className="flex items-center justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/workflows/${id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-6">
              {definition ? (
                <WorkflowFlowchart definition={definition} readOnly />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  This workflow's stored definition didn't parse against the current schema.
                  Recreate the workflow to fix this.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-6">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<History className="h-8 w-8" aria-hidden />}
                  title="No runs yet"
                  description="Trigger this workflow with “Run now” to start collecting history."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} hideWorkflow />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg tracking-tight">Status</CardTitle>
              <CardDescription>
                Active workflows run on their trigger; paused workflows are saved but idle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowSettingsActions workflowId={String(doc._id)} status={status} />
            </CardContent>
          </Card>

          {definition?.trigger.type === 'schedule.cron' ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg tracking-tight">Schedule</CardTitle>
                <CardDescription>
                  Edit the cron expression and timezone from the full editor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Cron:</span>{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    {definition.trigger.config.cron}
                  </code>
                </p>
                <p>
                  <span className="text-muted-foreground">Timezone:</span>{' '}
                  {definition.trigger.config.timezone}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg tracking-tight">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span>Created:</span>{' '}
                {doc.createdAt ? format(new Date(doc.createdAt), 'PP p') : '—'}
              </p>
              <p>
                <span>Last edited:</span>{' '}
                {doc.updatedAt ? format(new Date(doc.updatedAt), 'PP p') : '—'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  const meta = {
    active: {
      label: 'Active',
      variant: 'secondary' as const,
      icon: <CheckCircle2 className="size-3" aria-hidden />,
    },
    paused: {
      label: 'Draft',
      variant: 'outline' as const,
      icon: <PauseCircle className="size-3" aria-hidden />,
    },
    error: {
      label: 'Error',
      variant: 'destructive' as const,
      icon: <AlertTriangle className="size-3" aria-hidden />,
    },
  }[status];
  return (
    <Badge variant={meta.variant} className="gap-1">
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Walk the workflow definition collecting every referenced integration id,
 * then load those Integration docs and return a user-facing reason string
 * if any are not currently `active`. Returning null means Run now is safe.
 */
async function checkIntegrationsHealthy(
  definition: WorkflowDefinition,
  userId: string,
): Promise<string | null> {
  const ids = collectIntegrationIds(definition);
  if (ids.size === 0) return null;

  const docs = await Integration.find({
    userId: new Types.ObjectId(userId),
    _id: { $in: Array.from(ids).map((id) => new Types.ObjectId(id)) },
  })
    .select('_id status provider')
    .lean();

  const seen = new Map(docs.map((d) => [String(d._id), d]));
  for (const id of ids) {
    const doc = seen.get(id);
    if (!doc) {
      return 'This workflow references an integration you no longer have connected.';
    }
    const broken: IntegrationStatus[] = ['expired', 'error', 'revoked'];
    if (broken.includes(doc.status)) {
      return `Your ${doc.provider} integration is ${doc.status}. Reconnect it from the Integrations page.`;
    }
  }
  return null;
}

function collectIntegrationIds(definition: WorkflowDefinition): Set<string> {
  const ids = new Set<string>();
  const trigger = definition.trigger;
  if (trigger.type === 'gmail.email_received') {
    ids.add(trigger.config.integrationId);
  }

  function walkSteps(steps: WorkflowDefinition['steps']): void {
    for (const step of steps) {
      if (step.type === 'condition.if') {
        walkSteps(step.config.then);
        if (step.config.else) walkSteps(step.config.else);
        continue;
      }
      const config = step.config as { integrationId?: string };
      if (config.integrationId) ids.add(config.integrationId);
    }
  }
  walkSteps(definition.steps);
  return ids;
}
