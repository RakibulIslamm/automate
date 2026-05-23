'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { stepSchema, type Step } from '@/lib/workflows/dsl';
import { STEP_META } from './step-meta';

interface Props {
  step: Step | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (next: Step) => void;
}

/**
 * Edit one step's config in a dialog. The form fields are driven by the
 * step's `type` — we keep one local `draft` object scoped to the dialog so
 * users can cancel without leaking partial edits up to the workflow state.
 *
 * On save we re-parse against the canonical Zod schema so a typo can't
 * sneak an invalid shape into the workflow definition.
 */
export function WorkflowEditStepDialog({ step, open, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<Step | null>(step);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(step);
    setError(null);
  }, [step, open]);

  if (!draft) return null;
  const meta = STEP_META[draft.type];

  function updateConfig<K extends keyof Step['config']>(key: K, value: unknown) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        config: { ...(prev.config as Record<string, unknown>), [key as string]: value },
      } as Step;
    });
  }

  function handleSave() {
    setSaving(true);
    setError(null);
    const parsed = stepSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid step configuration.');
      setSaving(false);
      return;
    }
    onSave(parsed.data);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {meta.label}</DialogTitle>
          <DialogDescription>
            Tweak this step's configuration. References like{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{trigger.foo}}'}</code> are
            resolved at run time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Step id">
            <Input
              value={draft.id}
              onChange={(e) => setDraft((p) => (p ? { ...p, id: e.target.value } : p))}
            />
          </Field>

          {renderFields(draft, updateConfig)}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save step'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function renderFields(
  step: Step,
  set: <K extends keyof Step['config']>(key: K, value: unknown) => void,
): React.ReactNode {
  switch (step.type) {
    case 'gmail.get_attachments':
      return (
        <Field label="Message ID source" hint="Template ref to the Gmail message id.">
          <Input
            value={step.config.messageIdFrom}
            onChange={onString((v) => set('messageIdFrom' as never, v))}
          />
        </Field>
      );
    case 'gmail.send_email':
      return (
        <>
          <Field label="To">
            <Input value={step.config.toTemplate} onChange={onString((v) => set('toTemplate' as never, v))} />
          </Field>
          <Field label="Subject">
            <Input value={step.config.subjectTemplate} onChange={onString((v) => set('subjectTemplate' as never, v))} />
          </Field>
          <Field label="Body">
            <Textarea
              rows={6}
              value={step.config.bodyTemplate}
              onChange={onString((v) => set('bodyTemplate' as never, v))}
            />
          </Field>
        </>
      );
    case 'drive.upload_file':
      return (
        <>
          <Field label="Folder name">
            <Input
              value={step.config.folderName ?? ''}
              onChange={onString((v) => set('folderName' as never, v || undefined))}
            />
          </Field>
          <Field label="File source">
            <Input
              value={step.config.fileFrom}
              onChange={onString((v) => set('fileFrom' as never, v))}
            />
          </Field>
          <Field label="Filename template">
            <Input
              value={step.config.filenameTemplate ?? ''}
              onChange={onString((v) => set('filenameTemplate' as never, v || undefined))}
            />
          </Field>
        </>
      );
    case 'drive.create_folder':
      return (
        <Field label="Folder name">
          <Input value={step.config.name} onChange={onString((v) => set('name' as never, v))} />
        </Field>
      );
    case 'slack.post_message':
      return (
        <>
          <Field label="Channel" hint="Channel id (`C…`) or name (`#general`).">
            <Input value={step.config.channel} onChange={onString((v) => set('channel' as never, v))} />
          </Field>
          <Field label="Message">
            <Textarea
              rows={6}
              value={step.config.messageTemplate}
              onChange={onString((v) => set('messageTemplate' as never, v))}
            />
          </Field>
        </>
      );
    case 'notion.create_page':
      return (
        <>
          <Field label="Database (data source) id">
            <Input value={step.config.databaseId} onChange={onString((v) => set('databaseId' as never, v))} />
          </Field>
          <Field label="Properties (JSON)">
            <Textarea
              rows={8}
              value={JSON.stringify(step.config.propertiesTemplate, null, 2)}
              onChange={(e) => {
                try {
                  set('propertiesTemplate' as never, JSON.parse(e.target.value));
                } catch {
                  // Swallow — user is mid-edit. Save will surface schema errors.
                }
              }}
            />
          </Field>
        </>
      );
    case 'calendar.create_event':
      return (
        <>
          <Field label="Summary">
            <Input value={step.config.summary} onChange={onString((v) => set('summary' as never, v))} />
          </Field>
          <Field label="Start time">
            <Input value={step.config.startTimeTemplate} onChange={onString((v) => set('startTimeTemplate' as never, v))} />
          </Field>
          <Field label="End time">
            <Input value={step.config.endTimeTemplate} onChange={onString((v) => set('endTimeTemplate' as never, v))} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={4}
              value={step.config.descriptionTemplate ?? ''}
              onChange={onString((v) => set('descriptionTemplate' as never, v || undefined))}
            />
          </Field>
        </>
      );
    case 'ai.transform':
      return (
        <>
          <Field label="Instruction">
            <Textarea
              rows={4}
              value={step.config.instruction}
              onChange={onString((v) => set('instruction' as never, v))}
            />
          </Field>
          <Field label="Input source">
            <Input value={step.config.inputFrom} onChange={onString((v) => set('inputFrom' as never, v))} />
          </Field>
        </>
      );
    case 'condition.if':
      return (
        <Field
          label="Expression"
          hint='e.g. `{{attachments.count}} > 0`. Edit branches by editing the workflow definition directly.'
        >
          <Textarea
            rows={3}
            value={step.config.expression}
            onChange={onString((v) => set('expression' as never, v))}
          />
        </Field>
      );
  }
}

function onString(handler: (value: string) => void) {
  return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handler(e.target.value);
}
