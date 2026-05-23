'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Step, WorkflowDefinition } from '@/lib/workflows/dsl';
import { WorkflowFlowchart } from './workflow-flowchart';
import { WorkflowEditStepDialog } from './workflow-edit-step-dialog';
import {
  WorkflowSchedulePicker,
  type SchedulePickerValue,
} from './workflow-schedule-picker';
import { updateWorkflow } from '@/server/actions/workflows';

interface Props {
  workflowId: string;
  initialName: string;
  initialDescription: string;
  initialDefinition: WorkflowDefinition;
  originalPrompt: string | null;
}

/**
 * In-place editor for an existing workflow. Mirrors the "review" phase of
 * the AI builder — editable header, flowchart with per-step edit dialog,
 * schedule picker for cron triggers. Save persists via `updateWorkflow`
 * and navigates back to the detail page.
 */
export function WorkflowEditor({
  workflowId,
  initialName,
  initialDescription,
  initialDefinition,
  originalPrompt,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [definition, setDefinition] = useState<WorkflowDefinition>(initialDefinition);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [saving, setSaving] = useState(false);

  const schedule = useMemo<SchedulePickerValue | null>(() => {
    if (definition.trigger.type !== 'schedule.cron') return null;
    return definition.trigger.config;
  }, [definition]);

  function updateSchedule(next: SchedulePickerValue) {
    setDefinition((prev) => {
      if (prev.trigger.type !== 'schedule.cron') return prev;
      return { ...prev, trigger: { type: 'schedule.cron', config: next } };
    });
  }

  function updateStep(next: Step) {
    setDefinition((prev) => ({
      ...prev,
      steps: replaceStep(prev.steps, next),
    }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateWorkflow({
      workflowId,
      name,
      description,
      definition,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success('Workflow saved');
    router.push(`/dashboard/workflows/${workflowId}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/workflows/${workflowId}`}>
            <ArrowLeft className="size-3.5" />
            Back to workflow
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wf-desc">Description</Label>
            <Textarea
              id="wf-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 font-serif text-xl tracking-tight">Flow</h3>
            <WorkflowFlowchart
              definition={definition}
              onEditStep={(step) => setEditingStep(step)}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {schedule ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h3 className="font-serif text-xl tracking-tight">Schedule</h3>
                <WorkflowSchedulePicker value={schedule} onChange={updateSchedule} />
              </CardContent>
            </Card>
          ) : null}

          {originalPrompt ? (
            <Card>
              <CardContent className="space-y-2 p-6">
                <h3 className="font-serif text-xl tracking-tight">Original prompt</h3>
                <p className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                  “{originalPrompt}”
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/workflows/${workflowId}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save changes
            </>
          )}
        </Button>
      </div>

      <WorkflowEditStepDialog
        step={editingStep}
        open={editingStep !== null}
        onOpenChange={(open) => !open && setEditingStep(null)}
        onSave={(next) => {
          updateStep(next);
          setEditingStep(null);
        }}
      />
    </>
  );
}

function replaceStep(steps: Step[], next: Step): Step[] {
  return steps.map((step) => {
    if (step.id === next.id) return next;
    if (step.type === 'condition.if') {
      return {
        ...step,
        config: {
          ...step.config,
          then: replaceStep(step.config.then, next),
          else: step.config.else ? replaceStep(step.config.else, next) : undefined,
        },
      };
    }
    return step;
  });
}
