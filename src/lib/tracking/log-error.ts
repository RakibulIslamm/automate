import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { ErrorLog, type ErrorSeverity } from '@/lib/db/models';
import { AppError } from '@/lib/errors';

export interface LogErrorContext {
  userId?: string | Types.ObjectId;
  url?: string;
  userAgent?: string;
  method?: string;
  source?: string;
  extra?: Record<string, unknown>;
}

/**
 * Persist an error to the ErrorLog collection. NEVER throws — if logging
 * itself fails (DB down, schema mismatch, anything) we fall back to
 * console.error so the original handler can still respond to its caller.
 */
export async function logError(error: unknown, context: LogErrorContext = {}): Promise<void> {
  try {
    await connectDb();

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const name = error instanceof Error ? error.name : 'UnknownError';
    const code = error instanceof AppError ? error.code : undefined;

    await ErrorLog.create({
      message,
      stack,
      name,
      code,
      severity: inferSeverity(error),
      context: pruneUndefined({
        userId: context.userId ? String(context.userId) : undefined,
        url: context.url,
        userAgent: context.userAgent,
        method: context.method,
        source: context.source,
        ...(context.extra ?? {}),
      }),
      occurredAt: new Date(),
    });
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.error('[logError] failed to persist error', {
      original: error,
      loggingError: logErr,
    });
  }
}

function inferSeverity(error: unknown): ErrorSeverity {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) return 'high';
    if (error.statusCode === 429) return 'medium';
    if (error.statusCode >= 400) return 'low';
    return 'low';
  }
  // Non-AppError throws are surprising — escalate.
  return 'critical';
}

function pruneUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
