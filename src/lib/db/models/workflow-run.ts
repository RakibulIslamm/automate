import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const WORKFLOW_RUN_STATUSES = ['queued', 'running', 'success', 'failure', 'partial'] as const;
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

const workflowRunSchema = new Schema(
  {
    workflowId: { type: Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: WORKFLOW_RUN_STATUSES,
      default: 'queued' as WorkflowRunStatus,
    },
    triggerData: { type: Schema.Types.Mixed },
    stepResults: { type: [Schema.Types.Mixed], default: [] },
    errorMessage: { type: String },
    errorDetails: { type: Schema.Types.Mixed },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    costUsd: { type: Number },
  },
  { timestamps: true },
);

workflowRunSchema.index({ workflowId: 1, createdAt: -1 });
workflowRunSchema.index({ userId: 1, createdAt: -1 });

export type WorkflowRunDoc = InferSchemaType<typeof workflowRunSchema> & { _id: Types.ObjectId };

export const WorkflowRun: Model<WorkflowRunDoc> =
  (models.WorkflowRun as Model<WorkflowRunDoc>) ||
  model<WorkflowRunDoc>('WorkflowRun', workflowRunSchema);
