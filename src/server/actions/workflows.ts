'use server';

import { Types } from 'mongoose';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/safe-action';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration, Workflow, WORKFLOW_STATUSES, SCHEDULE_TYPES } from '@/lib/db/models';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { workflowDefinitionSchema, type WorkflowDefinition } from '@/lib/workflows/dsl';
import { validateWorkflow } from '@/lib/workflows/validator';
import { trackEvent } from '@/lib/tracking/event';
import { scheduleWorkflow, unscheduleWorkflow } from '@/lib/queue/qstash';
import { logError } from '@/lib/tracking/log-error';

/**
 * Phase 11 wires schedule.cron workflows to QStash. The flow:
 *   - create active + schedule.cron  →  scheduleWorkflow, save scheduleId
 *   - update changes the cron        →  unscheduleWorkflow, scheduleWorkflow
 *   - update flips trigger type      →  unscheduleWorkflow
 *   - pause                          →  unscheduleWorkflow
 *   - activate schedule.cron         →  scheduleWorkflow
 *   - delete                         →  unscheduleWorkflow
 *
 * Best-effort: if QStash fails, the action still succeeds — the operator
 * sees a log line and the user gets a normal-looking workflow. Better
 * than blocking the entire save flow on a transient Upstash glitch.
 */

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  originalPrompt: z.string().max(2000).optional(),
  definition: workflowDefinitionSchema,
  status: z.enum(WORKFLOW_STATUSES).default('active'),
});

export interface CreateWorkflowResult {
  workflowId: string;
}

export const createWorkflow = safeAction(
  createSchema,
  async (input): Promise<CreateWorkflowResult> => {
    const user = await requireUser();
    await connectDb();

    const integrationDocs = await Integration.find({ userId: user._id })
      .select('_id')
      .lean();
    const validIntegrationIds = new Set(integrationDocs.map((d) => String(d._id)));

    const semantic = validateWorkflow(input.definition, { validIntegrationIds });
    if (!semantic.ok) {
      throw new ValidationError('Workflow definition is invalid.', {
        definition: semantic.errors.join('; '),
      });
    }

    const scheduleType = mapTriggerToScheduleType(input.definition.trigger.type);
    const scheduleConfig =
      input.definition.trigger.type === 'schedule.cron'
        ? input.definition.trigger.config
        : undefined;

    const doc = await Workflow.create({
      userId: user._id,
      name: input.name,
      description: input.description,
      originalPrompt: input.originalPrompt,
      definition: semantic.data,
      scheduleType,
      scheduleConfig,
      status: input.status,
    });

    // Hook up the QStash schedule if the workflow is active + cron-driven.
    if (doc.status === 'active' && input.definition.trigger.type === 'schedule.cron') {
      const scheduleId = await trySchedule(String(doc._id), input.definition);
      if (scheduleId) {
        await Workflow.updateOne({ _id: doc._id }, { $set: { qstashScheduleId: scheduleId } });
      }
    }

    await trackEvent('workflow.created', {
      userId: String(user._id),
      workflowId: doc._id,
      properties: {
        status: doc.status,
        scheduleType: doc.scheduleType,
        trigger: input.definition.trigger.type,
        steps: input.definition.steps.length,
      },
    }).catch(() => {});

    revalidatePath('/dashboard/workflows');

    return { workflowId: String(doc._id) };
  },
);

/* ────────────────────────────────── update ────────────────────────────────── */

const idSchema = z.object({
  workflowId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), 'Invalid workflowId'),
});

const updateSchema = idSchema.extend({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  definition: workflowDefinitionSchema,
});

export interface UpdateWorkflowResult {
  workflowId: string;
}

export const updateWorkflow = safeAction(
  updateSchema,
  async (input): Promise<UpdateWorkflowResult> => {
    const user = await requireUser();
    await connectDb();
    const _id = new Types.ObjectId(input.workflowId);

    const existing = await Workflow.findOne({ _id, userId: user._id });
    if (!existing) throw new NotFoundError('Workflow not found.');

    const integrationDocs = await Integration.find({ userId: user._id })
      .select('_id')
      .lean();
    const validIntegrationIds = new Set(integrationDocs.map((d) => String(d._id)));

    const semantic = validateWorkflow(input.definition, { validIntegrationIds });
    if (!semantic.ok) {
      throw new ValidationError('Workflow definition is invalid.', {
        definition: semantic.errors.join('; '),
      });
    }

    const newScheduleType = mapTriggerToScheduleType(input.definition.trigger.type);
    const newScheduleConfig =
      input.definition.trigger.type === 'schedule.cron'
        ? input.definition.trigger.config
        : null;

    // Diff the schedule. If the trigger or cron changed, drop the old
    // QStash schedule and re-create one (only when the workflow is active).
    const prevCron =
      (existing.scheduleConfig as { cron?: string } | undefined)?.cron ?? null;
    const nextCron =
      input.definition.trigger.type === 'schedule.cron'
        ? input.definition.trigger.config.cron
        : null;
    const cronChanged = prevCron !== nextCron;

    let newScheduleId: string | null = (existing.qstashScheduleId as string | null) ?? null;
    if (cronChanged) {
      if (existing.qstashScheduleId) {
        await unscheduleWorkflow(existing.qstashScheduleId);
        newScheduleId = null;
      }
      if (existing.status === 'active' && nextCron) {
        newScheduleId = await trySchedule(input.workflowId, input.definition);
      }
    }

    await Workflow.updateOne(
      { _id },
      {
        $set: {
          name: input.name,
          description: input.description ?? null,
          definition: semantic.data,
          scheduleType: newScheduleType,
          scheduleConfig: newScheduleConfig,
          qstashScheduleId: newScheduleId,
        },
      },
    );

    await trackEvent('workflow.updated', {
      userId: String(user._id),
      workflowId: _id,
      properties: {
        trigger: input.definition.trigger.type,
        steps: input.definition.steps.length,
      },
    }).catch(() => {});

    revalidatePath('/dashboard/workflows');
    revalidatePath(`/dashboard/workflows/${input.workflowId}`);

    return { workflowId: input.workflowId };
  },
);

/* ────────────────────────────── delete + status ────────────────────────────── */

export const deleteWorkflow = safeAction(idSchema, async ({ workflowId }) => {
  const user = await requireUser();
  await connectDb();
  const _id = new Types.ObjectId(workflowId);
  const doc = await Workflow.findOne({ _id, userId: user._id });
  if (!doc) throw new NotFoundError('Workflow not found.');

  if (doc.qstashScheduleId) {
    await unscheduleWorkflow(doc.qstashScheduleId);
  }
  await Workflow.deleteOne({ _id });

  await trackEvent('workflow.deleted', {
    userId: String(user._id),
    workflowId: _id,
  }).catch(() => {});

  revalidatePath('/dashboard/workflows');
  return { ok: true as const };
});

const setStatusSchema = idSchema.extend({
  status: z.enum(WORKFLOW_STATUSES),
});

export const setWorkflowStatus = safeAction(setStatusSchema, async ({ workflowId, status }) => {
  const user = await requireUser();
  await connectDb();
  const _id = new Types.ObjectId(workflowId);
  const existing = await Workflow.findOne({ _id, userId: user._id });
  if (!existing) throw new NotFoundError('Workflow not found.');

  // Schedule transitions tied to status flips.
  let newScheduleId: string | null = (existing.qstashScheduleId as string | null) ?? null;
  const isCron =
    existing.scheduleType === 'schedule' &&
    !!(existing.scheduleConfig as { cron?: string } | undefined)?.cron;

  if (status === 'active' && isCron && !existing.qstashScheduleId) {
    const cron = (existing.scheduleConfig as { cron: string }).cron;
    try {
      const res = await scheduleWorkflow({ workflowId, cron });
      newScheduleId = res.scheduleId;
    } catch (err) {
      await logError(err, { source: 'setWorkflowStatus.schedule' });
    }
  } else if (status !== 'active' && existing.qstashScheduleId) {
    await unscheduleWorkflow(existing.qstashScheduleId);
    newScheduleId = null;
  }

  const updated = await Workflow.findOneAndUpdate(
    { _id, userId: user._id },
    { $set: { status, qstashScheduleId: newScheduleId } },
    { new: true },
  );
  if (!updated) throw new NotFoundError('Workflow not found.');

  await trackEvent('workflow.status_changed', {
    userId: String(user._id),
    workflowId: _id,
    properties: { status },
  }).catch(() => {});

  revalidatePath('/dashboard/workflows');
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  return { ok: true as const, status: updated.status };
});

/* ─────────────────────────────── helpers ─────────────────────────────── */

function mapTriggerToScheduleType(
  trigger: 'manual' | 'schedule.cron' | 'gmail.email_received',
): (typeof SCHEDULE_TYPES)[number] {
  switch (trigger) {
    case 'schedule.cron':
      return 'schedule';
    case 'manual':
      return 'manual';
    case 'gmail.email_received':
      return 'event';
  }
}

/**
 * Register a QStash schedule but swallow failures so the action still
 * succeeds. We log the error server-side — the user will see their
 * workflow saved but the scheduled-run history will simply not appear
 * until they edit + re-save. Better than blocking the whole save.
 */
async function trySchedule(
  workflowId: string,
  definition: WorkflowDefinition,
): Promise<string | null> {
  if (definition.trigger.type !== 'schedule.cron') return null;
  try {
    const res = await scheduleWorkflow({
      workflowId,
      cron: definition.trigger.config.cron,
    });
    return res.scheduleId;
  } catch (err) {
    await logError(err, { source: 'workflows.trySchedule' });
    return null;
  }
}
