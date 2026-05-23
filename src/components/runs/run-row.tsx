import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkflowRunStatus } from '@/lib/db/models';
import { RunStatusBadge } from './run-status-badge';

export interface RunRowData {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  costUsd: number | null;
}

interface Props {
  run: RunRowData;
  /**
   * Hide the workflow name (it's redundant on the per-workflow Runs tab,
   * where every row belongs to the same workflow).
   */
  hideWorkflow?: boolean;
}

/**
 * One row in the runs list. Used both on `/dashboard/runs` and on the
 * Workflow detail page's "Runs" tab.
 */
export function RunRow({ run, hideWorkflow }: Props) {
  return (
    <Link
      href={`/dashboard/runs/${run.id}`}
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1">
        {!hideWorkflow ? (
          <p className="truncate text-sm font-medium">{run.workflowName}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Started{' '}
          {run.startedAt
            ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
            : formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}{' '}
          ·{' '}
          {run.completedAt ? format(new Date(run.completedAt), 'PP p') : '—'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {run.durationMs != null ? `${formatDuration(run.durationMs)}` : '—'}
        </span>
        <span className="tabular-nums">
          {run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}
        </span>
        <RunStatusBadge status={run.status} />
      </div>
    </Link>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
