import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Play,
  Pencil,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  Hourglass,
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
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Workflow, type WorkflowStatus } from '@/lib/db/models';
import { workflowDefinitionSchema, type WorkflowDefinition } from '@/lib/workflows/dsl';
import { WorkflowFlowchart } from '@/components/workflows/workflow-flowchart';
import { WorkflowSettingsActions } from '@/components/workflows/workflow-settings-actions';

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

  return (
    <>
      <PageHeader
        title={doc.name}
        description={doc.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <Button variant="outline" disabled title="Run on demand lands in Phase 11">
              <Play className="size-4" />
              Run now
            </Button>
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
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4 text-muted-foreground">
                <Hourglass className="size-7" aria-hidden />
              </div>
              <h3 className="font-serif text-xl tracking-tight">Run history coming in Phase 11</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Once the execution engine ships, every run will show up here with its result, AI cost,
                and step-by-step logs.
              </p>
            </CardContent>
          </Card>
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
                  Edit the schedule in the full editor (Phase 10).
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
