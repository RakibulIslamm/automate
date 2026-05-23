import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

export const PLANS = ['free', 'starter', 'pro', 'business'] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'unpaid', 'none'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const usageSchema = new Schema(
  {
    runsThisPeriod: { type: Number, default: 0 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String },
    image: { type: String },
    emailVerified: { type: Date },
    isAdmin: { type: Boolean, default: false },
    plan: { type: String, enum: PLANS, default: 'free' as Plan },
    stripeCustomerId: { type: String, index: { sparse: true } },
    stripeSubscriptionId: { type: String },
    subscriptionStatus: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'none' as SubscriptionStatus,
    },
    usage: { type: usageSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>('User', userSchema);
