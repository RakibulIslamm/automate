import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WorkflowRunStatus } from '@/lib/db/models';

const META: Record<
  WorkflowRunStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ReactNode;
  }
> = {
  queued: {
    label: 'Queued',
    variant: 'outline',
    icon: <Clock className="size-3" aria-hidden />,
  },
  running: {
    label: 'Running',
    variant: 'secondary',
    icon: <Loader2 className="size-3 animate-spin" aria-hidden />,
  },
  success: {
    label: 'Success',
    variant: 'secondary',
    icon: <CheckCircle2 className="size-3 text-emerald-600" aria-hidden />,
  },
  failure: {
    label: 'Failed',
    variant: 'destructive',
    icon: <XCircle className="size-3" aria-hidden />,
  },
  partial: {
    label: 'Partial',
    variant: 'outline',
    icon: <AlertTriangle className="size-3" aria-hidden />,
  },
};

export function RunStatusBadge({ status }: { status: WorkflowRunStatus }) {
  const meta = META[status];
  return (
    <Badge variant={meta.variant} className="gap-1">
      {meta.icon}
      {meta.label}
    </Badge>
  );
}
