'use server';

import { Types } from 'mongoose';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/safe-action';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration, Workflow, WORKFLOW_STATUSES, SCHEDULE_TYPES } from '@/lib/db/models';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { workflowDefinitionSchema } from '@/lib/workflows/dsl';
import { validateWorkflow } from '@/lib/workflows/validator';
import { trackEvent } from '@/lib/tracking/event';

/**
 * Phase 9: persist the AI-generated (or user-edited) workflow.
 *
 * NOTE: status='active' workflows do NOT auto-execute yet — QStash scheduling
 * lands in Phase 11. We still set the status so the UI reflects intent and so
 * the scheduler can pick them up later without a follow-up migration.
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

    // Collect the user's integration ids so the validator can reject
    // workflows that reference somebody else's connection.
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

/* ────────────────────────────── delete + status ────────────────────────────── */

const idSchema = z.object({
  workflowId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), 'Invalid workflowId'),
});

export const deleteWorkflow = safeAction(idSchema, async ({ workflowId }) => {
  const user = await requireUser();
  await connectDb();
  const _id = new Types.ObjectId(workflowId);
  const doc = await Workflow.findOne({ _id, userId: user._id });
  if (!doc) throw new NotFoundError('Workflow not found.');
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
  const updated = await Workflow.findOneAndUpdate(
    { _id, userId: user._id },
    { $set: { status } },
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
