import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const INTEGRATION_PROVIDERS = ['google', 'slack', 'notion'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_STATUSES = ['active', 'expired', 'revoked', 'error'] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

const integrationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    providerAccountId: { type: String, required: true },
    displayName: { type: String },
    encryptedTokens: { type: String, required: true },
    scopes: { type: [String], default: [] },
    status: { type: String, enum: INTEGRATION_STATUSES, default: 'active' as IntegrationStatus },
    connectedAt: { type: Date, default: () => new Date() },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

integrationSchema.index(
  { userId: 1, provider: 1, providerAccountId: 1 },
  { unique: true, name: 'uniq_user_provider_account' },
);

export type IntegrationDoc = InferSchemaType<typeof integrationSchema> & { _id: Types.ObjectId };

export const Integration: Model<IntegrationDoc> =
  (models.Integration as Model<IntegrationDoc>) ||
  model<IntegrationDoc>('Integration', integrationSchema);
