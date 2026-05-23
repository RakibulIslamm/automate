import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

const eventLogSchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, index: { sparse: true } },
    workflowId: { type: Schema.Types.ObjectId, index: { sparse: true } },
    runId: { type: Schema.Types.ObjectId, index: { sparse: true } },
    properties: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

eventLogSchema.index({ occurredAt: -1 });
// TTL — auto-delete docs 30 days after occurredAt
eventLogSchema.index({ occurredAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS, name: 'occurredAt_ttl' });

export type EventLogDoc = InferSchemaType<typeof eventLogSchema> & { _id: Types.ObjectId };

export const EventLog: Model<EventLogDoc> =
  (models.EventLog as Model<EventLogDoc>) || model<EventLogDoc>('EventLog', eventLogSchema);
