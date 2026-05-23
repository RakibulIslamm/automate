import { z } from 'zod';

/**
 * AutoMate workflow DSL. A workflow has one trigger and an ordered list of
 * steps. Each step has a unique `id` so later steps can reference its
 * output via `{{step_id.field.path}}` templates resolved at execution time.
 *
 * This file is the single source of truth for the workflow shape — both
 * stored definitions in MongoDB and AI-generated definitions parse against
 * it. The interpreter, validator, and UI all derive their types from here.
 */

/* ───────────────────────────── shared bits ───────────────────────────── */

const stepIdSchema = z
  .string()
  .min(1, 'Step id is required')
  .regex(
    /^[a-z][a-z0-9_]*$/i,
    'Step id must start with a letter and contain only letters, digits, and underscores',
  );

const integrationIdSchema = z.string().min(1, 'integrationId is required');

const templateStringSchema = z.string();

/* ───────────────────────────────── triggers ──────────────────────────── */

export const TRIGGER_TYPES = [
  'manual',
  'schedule.cron',
  'gmail.email_received',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const manualTriggerSchema = z.object({
  type: z.literal('manual'),
  config: z.object({}).strict(),
});

export const scheduleCronTriggerSchema = z.object({
  type: z.literal('schedule.cron'),
  config: z.object({
    cron: z.string().min(1, 'cron expression is required'),
    timezone: z.string().min(1, 'timezone is required (IANA, e.g. "America/New_York")'),
  }),
});

export const gmailEmailReceivedTriggerSchema = z.object({
  type: z.literal('gmail.email_received'),
  config: z.object({
    integrationId: integrationIdSchema,
    /** Gmail search query, e.g. `from:invoices@vendor.com has:attachment`. */
    query: z.string().min(1, 'query is required'),
  }),
});

export const triggerSchema = z.discriminatedUnion('type', [
  manualTriggerSchema,
  scheduleCronTriggerSchema,
  gmailEmailReceivedTriggerSchema,
]);

export type Trigger = z.infer<typeof triggerSchema>;
export type ManualTrigger = z.infer<typeof manualTriggerSchema>;
export type ScheduleCronTrigger = z.infer<typeof scheduleCronTriggerSchema>;
export type GmailEmailReceivedTrigger = z.infer<typeof gmailEmailReceivedTriggerSchema>;

/* ───────────────────────────────── steps ─────────────────────────────── */

export const STEP_TYPES = [
  'gmail.get_attachments',
  'gmail.send_email',
  'drive.upload_file',
  'drive.create_folder',
  'slack.post_message',
  'notion.create_page',
  'calendar.create_event',
  'ai.transform',
  'condition.if',
] as const;
export type StepType = (typeof STEP_TYPES)[number];

// Each non-recursive step gets its own object schema. They share the same
// `{ id, type, config }` envelope so consumers can iterate uniformly.

const gmailGetAttachmentsStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('gmail.get_attachments'),
  config: z.object({
    integrationId: integrationIdSchema,
    /** Template ref to the Gmail message id, e.g. `{{trigger.message.id}}`. */
    messageIdFrom: templateStringSchema,
  }),
});

const gmailSendEmailStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('gmail.send_email'),
  config: z.object({
    integrationId: integrationIdSchema,
    toTemplate: templateStringSchema,
    subjectTemplate: templateStringSchema,
    bodyTemplate: templateStringSchema,
  }),
});

const driveUploadFileStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('drive.upload_file'),
  config: z
    .object({
      integrationId: integrationIdSchema,
      folderName: z.string().optional(),
      folderId: z.string().optional(),
      /** Template ref to the source file (e.g. `{{step_1.attachments[0]}}`). */
      fileFrom: templateStringSchema,
      filenameTemplate: templateStringSchema.optional(),
    })
    .refine(
      (v) => v.folderName !== undefined || v.folderId !== undefined,
      { message: 'Provide either folderName or folderId.', path: ['folderName'] },
    ),
});

const driveCreateFolderStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('drive.create_folder'),
  config: z.object({
    integrationId: integrationIdSchema,
    name: z.string().min(1),
    parentId: z.string().optional(),
  }),
});

const slackPostMessageStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('slack.post_message'),
  config: z.object({
    integrationId: integrationIdSchema,
    /** Channel id (`C…`) or name (`#general`). */
    channel: z.string().min(1),
    messageTemplate: templateStringSchema,
  }),
});

const notionCreatePageStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('notion.create_page'),
  config: z.object({
    integrationId: integrationIdSchema,
    /** Notion database (data-source in v5 SDK terms) id. */
    databaseId: z.string().min(1),
    /** Property values, each may contain `{{…}}` template refs. */
    propertiesTemplate: z.record(z.string(), z.unknown()),
  }),
});

const calendarCreateEventStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('calendar.create_event'),
  config: z.object({
    integrationId: integrationIdSchema,
    summary: templateStringSchema,
    /** ISO 8601 datetime or template ref resolving to one. */
    startTimeTemplate: templateStringSchema,
    endTimeTemplate: templateStringSchema,
    descriptionTemplate: templateStringSchema.optional(),
  }),
});

const aiTransformStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal('ai.transform'),
  config: z.object({
    /** Free-form natural-language instruction to the model. */
    instruction: z.string().min(1),
    /** Template ref to the input the model will operate on. */
    inputFrom: templateStringSchema,
  }),
});

// `condition.if` recursively contains step arrays. We declare the union
// schema first as a `z.lazy` thunk so the recursive reference resolves.
export type Step =
  | z.infer<typeof gmailGetAttachmentsStepSchema>
  | z.infer<typeof gmailSendEmailStepSchema>
  | z.infer<typeof driveUploadFileStepSchema>
  | z.infer<typeof driveCreateFolderStepSchema>
  | z.infer<typeof slackPostMessageStepSchema>
  | z.infer<typeof notionCreatePageStepSchema>
  | z.infer<typeof calendarCreateEventStepSchema>
  | z.infer<typeof aiTransformStepSchema>
  | ConditionIfStep;

export interface ConditionIfStep {
  id: string;
  type: 'condition.if';
  config: {
    /** Expression evaluated against the runtime context; truthy → `then`. */
    expression: string;
    then: Step[];
    else?: Step[];
  };
}

const conditionIfStepSchema: z.ZodType<ConditionIfStep> = z.lazy(() =>
  z.object({
    id: stepIdSchema,
    type: z.literal('condition.if'),
    config: z.object({
      expression: z.string().min(1, 'expression is required'),
      then: z.array(stepSchema).min(1, '`then` branch must have at least one step'),
      else: z.array(stepSchema).optional(),
    }),
  }),
);

const stepInnerSchema = z.discriminatedUnion('type', [
  gmailGetAttachmentsStepSchema,
  gmailSendEmailStepSchema,
  driveUploadFileStepSchema,
  driveCreateFolderStepSchema,
  slackPostMessageStepSchema,
  notionCreatePageStepSchema,
  calendarCreateEventStepSchema,
  aiTransformStepSchema,
]);

export const stepSchema: z.ZodType<Step> = z.lazy(() =>
  z.union([stepInnerSchema, conditionIfStepSchema]),
);

/* ────────────────────────────── full workflow ────────────────────────── */

export const workflowDefinitionSchema = z.object({
  /** Optional human-readable identifier, primarily for logs/UI. */
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  trigger: triggerSchema,
  steps: z.array(stepSchema).min(1, 'A workflow must have at least one step'),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

/* ─────────────────────────── type helpers ────────────────────────────── */

export type StepOfType<T extends StepType> = Extract<Step, { type: T }>;
export type TriggerOfType<T extends TriggerType> = Extract<Trigger, { type: T }>;

/**
 * Step types that reference an `integrationId` in their config. The
 * validator uses this to walk the steps and verify each integration id
 * belongs to the current user.
 */
export const STEP_TYPES_WITH_INTEGRATION = new Set<StepType>([
  'gmail.get_attachments',
  'gmail.send_email',
  'drive.upload_file',
  'drive.create_folder',
  'slack.post_message',
  'notion.create_page',
  'calendar.create_event',
]);
