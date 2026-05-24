'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2, Sparkles, Save, Play, Trash2 } from 'lucide-react';
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
import { createWorkflow } from '@/server/actions/workflows';

type Phase = 'input' | 'building' | 'review';

const EXAMPLES = [
  "When I receive a Gmail with 'invoice' in subject, save the attachment to my Drive 'Invoices' folder and notify #finance in Slack",
  "Every Monday at 9am, post 'Good morning team! Here's what's planned this week' to #general in Slack",
  'Log every email I send to support@mycompany.com to a Notion database "Inbound Inquiries"',
  'Every weekday at 8am, create a calendar event titled "Morning standup" lasting 30 minutes',
];

const BUILDING_PHRASES = [
  'Parsing your request…',
  'Choosing integrations…',
  'Designing the workflow…',
  'Almost done…',
];

interface ApiResult {
  definition: WorkflowDefinition;
  suggestedName: string;
  suggestedDescription: string;
}

export function WorkflowBuilder() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('input');
  const [prompt, setPrompt] = useState('');
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [buildingPhraseIndex, setBuildingPhraseIndex] = useState(0);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState<'draft' | 'activate' | null>(null);
  /** When the build call hits the BYOK gate, we render an inline alert
   * with a link to /dashboard/byok instead of a generic error toast. */
  const [byokRequired, setByokRequired] = useState<string | null>(null);

  // Rotate placeholder examples every 4s.
  useEffect(() => {
    if (phase !== 'input') return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % EXAMPLES.length;
      setPlaceholder(EXAMPLES[i]);
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  // Rotate building phrases while we wait on the API.
  useEffect(() => {
    if (phase !== 'building') return;
    setBuildingPhraseIndex(0);
    const t = setInterval(() => {
      setBuildingPhraseIndex((i) => Math.min(i + 1, BUILDING_PHRASES.length - 1));
    }, 1500);
    return () => clearInterval(t);
  }, [phase]);

  const schedule = useMemo<SchedulePickerValue | null>(() => {
    if (!result) return null;
    if (result.definition.trigger.type !== 'schedule.cron') return null;
    return result.definition.trigger.config;
  }, [result]);

  function updateSchedule(next: SchedulePickerValue) {
    setResult((prev) => {
      if (!prev) return prev;
      if (prev.definition.trigger.type !== 'schedule.cron') return prev;
      return {
        ...prev,
        definition: {
          ...prev.definition,
          trigger: { type: 'schedule.cron', config: next },
        },
      };
    });
  }

  function updateStep(next: Step) {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        definition: {
          ...prev.definition,
          steps: replaceStep(prev.definition.steps, next),
        },
      };
    });
  }

  async function handleBuild() {
    if (prompt.trim().length < 10) {
      toast.error('Describe what you want to automate in a few more words.');
      return;
    }
    setByokRequired(null);
    setPhase('building');
    try {
      const res = await fetch('/api/workflows/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await res.json()) as
        | { data: ApiResult }
        | { error: { code?: string; message: string } };
      if (!res.ok || 'error' in payload) {
        const err = 'error' in payload ? payload.error : { code: undefined, message: 'Build failed.' };
        if (err.code === 'BYOK_KEY_REQUIRED') {
          setByokRequired(err.message);
        } else {
          toast.error(err.message);
        }
        setPhase('input');
        return;
      }
      setResult(payload.data);
      setName(payload.data.suggestedName);
      setDescription(payload.data.suggestedDescription);
      setPhase('review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Build failed.');
      setPhase('input');
    }
  }

  async function handleSave(status: 'paused' | 'active') {
    if (!result) return;
    if (result.definition.steps.length === 0) {
      toast.error("This workflow has no steps — connect the missing integration first.");
      return;
    }
    setSaving(status === 'paused' ? 'draft' : 'activate');
    const action = await createWorkflow({
      name,
      description,
      originalPrompt: prompt,
      definition: result.definition,
      status,
    });
    setSaving(null);
    if (!action.ok) {
      toast.error(action.error.message);
      return;
    }
    toast.success(status === 'active' ? 'Workflow activated' : 'Saved as draft');
    router.push(`/dashboard/workflows/${action.data.workflowId}`);
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-2xl"
          >
            {byokRequired ? (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50/50 p-5 dark:bg-amber-950/20">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <KeyRound className="size-4" aria-hidden />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Add an AI key to use the builder
                  </p>
                  <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
                    {byokRequired} It takes ~30 seconds — pick a provider (OpenAI,
                    Anthropic, OpenRouter, or DeepSeek), paste your key, save.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href="/dashboard/byok">
                        <KeyRound className="size-3.5" />
                        Open BYOK settings
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setByokRequired(null)}
                      className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <Card>
              <CardContent className="p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4" />
                  AI builder · powered by Claude Sonnet
                </div>
                <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
                  What do you want to automate?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Describe it in plain English. Mention your tools by name — Gmail,
                  Drive, Slack, Notion, Calendar.
                </p>
                <div className="mt-6 space-y-2">
                  <Label htmlFor="prompt" className="sr-only">
                    Prompt
                  </Label>
                  <Textarea
                    id="prompt"
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-44 text-base leading-relaxed"
                  />
                </div>
                <Button
                  size="lg"
                  className="mt-5 w-full sm:w-auto"
                  onClick={handleBuild}
                  disabled={prompt.trim().length < 10}
                >
                  <Sparkles className="size-4" />
                  Build with AI
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Tip: try “When I receive a Gmail with ‘invoice’ in subject, save the
                  attachment to Drive and post to Slack.”
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'building' && (
          <motion.div
            key="building"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-2xl"
          >
            <Card>
              <CardContent className="flex flex-col items-center gap-6 px-6 py-16 text-center">
                <motion.div
                  className="grid size-16 place-items-center rounded-full bg-fuchsia-50 text-fuchsia-600 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="size-7" />
                </motion.div>
                <div className="space-y-1.5">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={buildingPhraseIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35 }}
                      className="text-lg font-medium"
                    >
                      {BUILDING_PHRASES[buildingPhraseIndex]}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-sm text-muted-foreground">
                    Claude is thinking through your request. This usually takes 3–8 seconds.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'review' && result && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhase('input')}
              >
                <ArrowLeft className="size-3.5" />
                Back to prompt
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
                    definition={result.definition}
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

                <Card>
                  <CardContent className="space-y-2 p-6">
                    <h3 className="font-serif text-xl tracking-tight">Original prompt</h3>
                    <p className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                      “{prompt}”
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setPhase('input');
                }}
              >
                <Trash2 className="size-4" />
                Discard
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => handleSave('paused')}
                disabled={saving !== null}
              >
                {saving === 'draft' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save as draft
                  </>
                )}
              </Button>
              <Button onClick={() => handleSave('active')} disabled={saving !== null}>
                {saving === 'activate' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Activating…
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Save & activate
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
