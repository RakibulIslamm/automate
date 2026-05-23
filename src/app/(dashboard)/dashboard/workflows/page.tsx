import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Plus, CheckCircle2, PauseCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Workflow, type WorkflowStatus, type ScheduleType } from '@/lib/db/models';

export const metadata: Metadata = { title: 'Workflows' };

const STATUS_META: Record<
  WorkflowStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    variant: 'secondary',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
  },
  paused: {
    label: 'Draft',
    variant: 'outline',
    icon: <PauseCircle className="size-3" aria-hidden />,
  },
  error: {
    label: 'Error',
    variant: 'destructive',
    icon: <AlertTriangle className="size-3" aria-hidden />,
  },
};

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  event: 'Event-driven',
};

export default async function WorkflowsPage() {
  const user = await requireUser();
  await connectDb();
  const docs = await Workflow.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();

  if (docs.length === 0) {
    return (
      <>
        <PageHeader
          title="Workflows"
          description="Plain-English automations that AutoMate runs on your schedule."
          action={
            <Button asChild>
              <Link href="/dashboard/workflows/new">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Create workflow
              </Link>
            </Button>
          }
        />
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            title="No workflows yet"
            description="Describe an automation in plain English to get started — for example: When I receive a Gmail with 'invoice' in the subject, save the attachment to Drive."
            action={
              <Button asChild>
                <Link href="/dashboard/workflows/new">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Create your first workflow
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Plain-English automations that AutoMate runs on your schedule."
        action={
          <Button asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Create workflow
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => {
          const status = STATUS_META[doc.status as WorkflowStatus];
          return (
            <Card key={String(doc._id)} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1">{doc.name}</CardTitle>
                  <Badge variant={status.variant} className="gap-1">
                    {status.icon}
                    {status.label}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 min-h-10">
                  {doc.description ?? '—'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{SCHEDULE_LABELS[doc.scheduleType as ScheduleType]}</Badge>
                  <Badge variant="outline">{doc.runCount ?? 0} runs</Badge>
                </div>
                {doc.lastRunAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last run {formatDistanceToNow(new Date(doc.lastRunAt), { addSuffix: true })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Hasn't run yet</p>
                )}
              </CardContent>
              <CardFooter className="mt-auto justify-end gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/workflows/${String(doc._id)}`}>View</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </>
  );
}
