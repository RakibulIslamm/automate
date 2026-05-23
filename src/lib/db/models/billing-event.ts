import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose';

const billingEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    stripeEventId: { type: String, index: { unique: true, sparse: true } },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type BillingEventDoc = InferSchemaType<typeof billingEventSchema> & {
  _id: Types.ObjectId;
};

export const BillingEvent: Model<BillingEventDoc> =
  (models.BillingEvent as Model<BillingEventDoc>) ||
  model<BillingEventDoc>('BillingEvent', billingEventSchema);
