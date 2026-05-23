import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { EventLog } from '@/lib/db/models';

type Id = string | Types.ObjectId;

export interface TrackEventData {
  userId?: Id;
  workflowId?: Id;
  runId?: Id;
  properties?: Record<string, unknown>;
}

/**
 * Persist a product event. NEVER throws — analytics shouldn't break the user
 * flow. If the DB is unreachable we just log to console and move on.
 */
export async function trackEvent(name: string, data: TrackEventData = {}): Promise<void> {
  try {
    await connectDb();
    await EventLog.create({
      name,
      userId: data.userId ? new Types.ObjectId(String(data.userId)) : undefined,
      workflowId: data.workflowId ? new Types.ObjectId(String(data.workflowId)) : undefined,
      runId: data.runId ? new Types.ObjectId(String(data.runId)) : undefined,
      properties: data.properties,
      occurredAt: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[trackEvent] failed', { name, err });
  }
}
