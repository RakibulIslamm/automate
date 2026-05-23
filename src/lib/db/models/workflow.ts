import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const WORKFLOW_STATUSES = ['active', 'paused', 'error'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const SCHEDULE_TYPES = ['event', 'schedule', 'manual'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const LAST_RUN_STATUSES = ['success', 'failure', 'running'] as const;
export type LastRunStatus = (typeof LAST_RUN_STATUSES)[number];

const workflowSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    originalPrompt: { type: String },
    definition: { type: Schema.Types.Mixed },
    status: { type: String, enum: WORKFLOW_STATUSES, default: 'active' as WorkflowStatus },
    scheduleType: { type: String, enum: SCHEDULE_TYPES, required: true },
    scheduleConfig: { type: Schema.Types.Mixed },
    lastRunAt: { type: Date },
    lastRunStatus: { type: String, enum: LAST_RUN_STATUSES, default: null },
    runCount: { type: Number, default: 0 },
    qstashScheduleId: { type: String, default: null },
  },
  { timestamps: true },
);

workflowSchema.index({ userId: 1, status: 1 });

export type WorkflowDoc = InferSchemaType<typeof workflowSchema> & { _id: Types.ObjectId };

export const Workflow: Model<WorkflowDoc> =
  (models.Workflow as Model<WorkflowDoc>) || model<WorkflowDoc>('Workflow', workflowSchema);
