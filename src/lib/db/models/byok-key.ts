import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const BYOK_PROVIDERS = ['openai', 'anthropic', 'openrouter', 'deepseek'] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

// Kept as a separate alias for callers that semantically operate only on
// AI providers — historically there was also a 'stripe' BYOK row, but
// Stripe BYOK was removed in favour of platform-only billing.
export const BYOK_AI_PROVIDERS = BYOK_PROVIDERS;
export type ByokAiProvider = ByokProvider;

export const BYOK_STATUSES = ['untested', 'active', 'invalid', 'rate_limited'] as const;
export type ByokStatus = (typeof BYOK_STATUSES)[number];

/**
 * User-supplied AI provider API keys for the BYOK (Bring Your Own Key)
 * feature. One row per (user, provider). Keys are AES-256-GCM encrypted
 * at rest using the same envelope as OAuth tokens
 * (`iv:authTag:ciphertext`, all hex).
 */
const byokKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: BYOK_PROVIDERS, required: true },
    encryptedKey: { type: String, required: true },
    /** AI model id selected for this provider (e.g. `gpt-4o-mini`).
     * Optional — falls back to the cheapest model in the provider's curated list. */
    selectedModel: { type: String },
    /** Display-only tail of the key — e.g. `sk-…abcd`. Never holds the full key. */
    last4: { type: String, required: true },
    status: { type: String, enum: BYOK_STATUSES, default: 'untested' as ByokStatus },
    lastTestedAt: { type: Date },
  },
  { timestamps: true },
);

byokKeySchema.index(
  { userId: 1, provider: 1 },
  { unique: true, name: 'uniq_user_byok_provider' },
);

export type ByokKeyDoc = InferSchemaType<typeof byokKeySchema> & { _id: Types.ObjectId };

export const ByokKey: Model<ByokKeyDoc> =
  (models.ByokKey as Model<ByokKeyDoc>) ||
  model<ByokKeyDoc>('ByokKey', byokKeySchema);
