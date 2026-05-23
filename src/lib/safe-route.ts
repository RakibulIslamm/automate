import { NextResponse, type NextRequest } from 'next/server';
import { type ZodError, type ZodType } from 'zod';
import { AppError, RateLimitError, ValidationError } from './errors';

/**
 * Wrap a Next.js route handler so it never leaks stack traces or unhandled
 * exceptions. Validation runs against `schema` (if provided) on either the
 * parsed JSON body (POST/PUT/PATCH/DELETE) or the search params (GET).
 *
 * AppErrors flow through with their `statusCode`/`code`. Anything else gets
 * logged and returned as a 500 with a generic message.
 */

export interface SafeRouteOptions<TInput, TOutput> {
  schema?: ZodType<TInput>;
  handler: (input: TInput, req: NextRequest) => Promise<TOutput | NextResponse>;
}

export interface RouteErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function safeRoute<TInput, TOutput>(opts: SafeRouteOptions<TInput, TOutput>) {
  return async function handler(req: NextRequest): Promise<NextResponse> {
    try {
      let input = undefined as unknown as TInput;

      if (opts.schema) {
        const raw = await extractInput(req);
        const parsed = opts.schema.safeParse(raw);
        if (!parsed.success) {
          return jsonError(
            { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.', fields: zodFieldErrors(parsed.error) },
            400,
          );
        }
        input = parsed.data;
      }

      const result = await opts.handler(input, req);
      if (result instanceof NextResponse) return result;
      return NextResponse.json({ data: result });
    } catch (err) {
      return handleRouteError(err);
    }
  };
}

async function extractInput(req: NextRequest): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Object.fromEntries(req.nextUrl.searchParams.entries());
  }
  return req.json().catch(() => ({}));
}

function handleRouteError(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return jsonError(
      { code: err.code, message: err.publicMessage, fields: err.fields },
      err.statusCode,
    );
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      // TODO(Phase 3): persist to ErrorLog model
      // eslint-disable-next-line no-console
      console.error(`[${err.code}]`, err);
    }
    const res = jsonError({ code: err.code, message: err.publicMessage }, err.statusCode);
    if (err instanceof RateLimitError && err.retryAfterSeconds) {
      res.headers.set('Retry-After', String(err.retryAfterSeconds));
    }
    return res;
  }

  // TODO(Phase 3): persist to ErrorLog model
  // eslint-disable-next-line no-console
  console.error('[UNHANDLED_ROUTE_ERROR]', err);
  return jsonError({ code: 'INTERNAL_ERROR', message: 'Something went wrong.' }, 500);
}

function jsonError(error: RouteErrorBody['error'], status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}
