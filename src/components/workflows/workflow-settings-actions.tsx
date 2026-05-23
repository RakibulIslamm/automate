'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  deleteWorkflow,
  setWorkflowStatus,
} from '@/server/actions/workflows';
import type { WorkflowStatus } from '@/lib/db/models';

interface Props {
  workflowId: string;
  status: WorkflowStatus;
}

/**
 * Status toggle + destructive delete for the Settings tab. Lives in its own
 * client island so the rest of the detail page stays a server component.
 */
export function WorkflowSettingsActions({ workflowId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function toggleStatus() {
    const next: WorkflowStatus = status === 'active' ? 'paused' : 'active';
    startTransition(async () => {
      const res = await setWorkflowStatus({ workflowId, status: next });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(next === 'active' ? 'Workflow activated' : 'Workflow paused');
      router.refresh();
    });
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteWorkflow({ workflowId });
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success('Workflow deleted');
    router.push('/dashboard/workflows');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={toggleStatus} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Updating…
          </>
        ) : status === 'active' ? (
          'Pause workflow'
        ) : (
          'Activate workflow'
        )}
      </Button>

      <div className="flex-1" />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" />
            Delete workflow
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the workflow and its history. This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
