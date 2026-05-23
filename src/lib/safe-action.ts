import { z, type ZodError, type ZodType } from 'zod';
import { AppError, ValidationError } from './errors';
import { logError } from './tracking/log-error';

/**
 * Wrap a server action so it never throws to the client. Returns a tagged
 * union — `{ ok: true, data }` on success, `{ ok: false, error }` otherwise.
 * Validation errors flow back with a `fields` map so forms can render
 * per-field messages without extra plumbing.
 */

export interface ActionError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export type SafeAction<TInput, TOutput> = (raw: unknown) => Promise<ActionResult<TOutput>>;

export function safeAction<TInput, TOutput>(
  schema: ZodType<TInput>,
  fn: (input: TInput) => Promise<TOutput>,
): SafeAction<TInput, TOutput> {
  return async (raw: unknown): Promise<ActionResult<TOutput>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          fields: zodFieldErrors(parsed.error),
        },
      };
    }

    try {
      const data = await fn(parsed.data);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: await toActionError(err) };
    }
  };
}

async function toActionError(err: unknown): Promise<ActionError> {
  if (err instanceof ValidationError) {
    return { code: err.code, message: err.publicMessage, fields: err.fields };
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[${err.code}]`, err);
      await logError(err, { source: 'safe-action' });
    }
    return { code: err.code, message: err.publicMessage };
  }

  // eslint-disable-next-line no-console
  console.error('[UNHANDLED_ACTION_ERROR]', err);
  await logError(err, { source: 'safe-action' });
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}

// Re-export the namespace so consumers don't need a second import for typing.
export type { z };
