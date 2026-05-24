import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Plus, ArrowRight, Clock, Mail, Hand, Workflow as WorkflowIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  Workflow,
  type WorkflowStatus,
  type ScheduleType,
  type LastRunStatus,
} from '@/lib/db/models';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Workflows' };

const SCHEDULE_META: Record<ScheduleType, { label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }> = {
  manual: { label: 'Manual', icon: Hand },
  schedule: { label: 'Scheduled', icon: Clock },
  event: { label: 'Event-driven', icon: Mail },
};

const STATUS_DOT: Record<WorkflowStatus, string> = {
  active: 'bg-emerald-500',
  paused: 'bg-muted-foreground/40',
  error: 'bg-rose-500',
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  active: 'Active',
  paused: 'Draft',
  error: 'Error',
};

const LAST_RUN_TONE: Record<LastRunStatus, string> = {
  success: 'text-emerald-600',
  failure: 'text-rose-600',
  running: 'text-amber-600',
};

export default async function WorkflowsPage() {
  const user = await requireUser();
  await connectDb();
  const docs = await Workflow.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Workflows"
        description="Plain-English automations that AutoMate runs on your schedule, on an email, or on demand."
        action={
          <Button asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="size-3.5" aria-hidden />
              New workflow
            </Link>
          </Button>
        }
      />

      {docs.length === 0 ? (
        <EmptyHero />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => {
            const status = doc.status as WorkflowStatus;
            const scheduleType = doc.scheduleType as ScheduleType;
            const schedule = SCHEDULE_META[scheduleType];
            const lastRunStatus = doc.lastRunStatus as LastRunStatus | null;
            return (
              <li key={String(doc._id)}>
                <Link
                  href={`/dashboard/workflows/${String(doc._id)}`}
                  className="group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/30"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('inline-block size-1.5 rounded-full', STATUS_DOT[status])} aria-hidden />
                        {STATUS_LABEL[status]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                        <schedule.icon className="size-3" aria-hidden />
                        {schedule.label}
                      </span>
                    </div>
                    <h3 className="mt-3 font-serif text-xl leading-snug tracking-tight line-clamp-2">
                      {doc.name}
                    </h3>
                    {doc.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {doc.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-3 border-t border-border/40 pt-4">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="font-mono text-base tabular-nums">
                        {doc.runCount ?? 0}
                      </span>
                      <span className="uppercase tracking-wide text-muted-foreground">
                        runs
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs">
                      {doc.lastRunAt ? (
                        <>
                          <span
                            className={cn(
                              'capitalize',
                              lastRunStatus ? LAST_RUN_TONE[lastRunStatus] : 'text-muted-foreground',
                            )}
                          >
                            {lastRunStatus ?? '—'}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(doc.lastRunAt), { addSuffix: true })}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never run</span>
                      )}
                    </div>
                    <ArrowRight
                      className="size-4 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center sm:p-14">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-foreground">
        <WorkflowIcon className="size-5" aria-hidden />
      </div>
      <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
        No workflows yet
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Describe an automation in plain English — like &ldquo;when I get a Gmail with &lsquo;invoice&rsquo;,
        save the attachment to Drive&rdquo; — and AutoMate builds it for you.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/dashboard/workflows/new">
            <Plus className="size-3.5" aria-hidden />
            Describe your first workflow
          </Link>
        </Button>
      </div>
    </div>
  );
}
