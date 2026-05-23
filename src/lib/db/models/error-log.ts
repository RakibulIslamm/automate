import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const ERROR_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

const errorLogSchema = new Schema(
  {
    message: { type: String, required: true },
    stack: { type: String },
    name: { type: String },
    code: { type: String },
    severity: { type: String, enum: ERROR_SEVERITIES, default: 'medium' as ErrorSeverity },
    context: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

errorLogSchema.index({ occurredAt: -1 });
errorLogSchema.index({ severity: 1 });
// TTL — auto-delete docs 30 days after occurredAt
errorLogSchema.index({ occurredAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS, name: 'occurredAt_ttl' });

export type ErrorLogDoc = InferSchemaType<typeof errorLogSchema> & { _id: Types.ObjectId };

export const ErrorLog: Model<ErrorLogDoc> =
  (models.ErrorLog as Model<ErrorLogDoc>) || model<ErrorLogDoc>('ErrorLog', errorLogSchema);
