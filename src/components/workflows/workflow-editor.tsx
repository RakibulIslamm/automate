'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Workflow as WorkflowIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

  const isDirty =
    name !== initialName ||
    description !== initialDescription ||
    JSON.stringify(definition) !== JSON.stringify(initialDefinition);

  const stepCount = countSteps(definition.steps);

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
    <div className="pb-24">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/workflows/${workflowId}`}>
            <ArrowLeft className="size-3.5" />
            Back to workflow
          </Link>
        </Button>
        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono tabular-nums text-foreground">{stepCount}</span> steps
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            Trigger:
            <span className="font-mono text-foreground">{definition.trigger.type}</span>
          </span>
          {isDirty ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Identity — borderless editorial header style */}
          <section className="space-y-5 rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Identity
                </p>
                <h2 className="mt-1 font-serif text-2xl tracking-tight">Name & description</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wf-name" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="wf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 border-border/60 font-serif text-lg tracking-tight"
                  placeholder="Untitled workflow"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-desc" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="wf-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-border/60"
                  placeholder="What does this workflow do?"
                />
              </div>
            </div>
          </section>

          {/* Flow */}
          <section className="rounded-2xl border border-border/60 bg-card">
            <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Pipeline
                </p>
                <h2 className="font-serif text-2xl tracking-tight">Flow</h2>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Click any step to edit
              </span>
            </header>
            <div className="p-6">
              <WorkflowFlowchart
                definition={definition}
                onEditStep={(step) => setEditingStep(step)}
              />
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          {schedule ? (
            <section className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Trigger
                  </p>
                  <h3 className="mt-1 font-serif text-xl tracking-tight">Schedule</h3>
                </div>
                <WorkflowIcon className="size-4 text-muted-foreground/60" aria-hidden />
              </div>
              <WorkflowSchedulePicker value={schedule} onChange={updateSchedule} />
            </section>
          ) : null}

          {originalPrompt ? (
            <section className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Original prompt
              </p>
              <blockquote className="border-l-2 border-foreground/30 pl-3 font-serif text-[15px] italic leading-relaxed text-foreground/80">
                {originalPrompt}
              </blockquote>
            </section>
          ) : null}

          <section className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Editing tips</p>
            <ul className="space-y-1">
              <li>· Steps run top-to-bottom.</li>
              <li>· Branches show side-by-side under If.</li>
              <li>· Save persists changes to the existing workflow.</li>
            </ul>
          </section>
        </aside>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Unsaved changes will be discarded if you leave.
              </span>
            ) : (
              <span>All changes saved.</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/workflows/${workflowId}`}>Cancel</Link>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
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
        </div>
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
    </div>
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

function countSteps(steps: Step[]): number {
  let n = 0;
  for (const s of steps) {
    n += 1;
    if (s.type === 'condition.if') {
      n += countSteps(s.config.then);
      if (s.config.else) n += countSteps(s.config.else);
    }
  }
  return n;
}
