import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safeRoute } from '@/lib/safe-route';
import { logError } from '@/lib/tracking/log-error';

/**
 * Client-side error sink. ErrorBoundary, global-error.tsx and route-level
 * error.tsx all POST here with the error details, and we persist a row to
 * the ErrorLog collection. The endpoint is fire-and-forget from the client's
 * perspective — it returns 200 even if persistence fails (logError swallows).
 */

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(20_000).optional(),
  name: z.string().max(200).optional(),
  digest: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  componentStack: z.string().max(20_000).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const POST = safeRoute({
  schema: bodySchema,
  handler: async (input, req) => {
    const err = new Error(input.message);
    if (input.stack) err.stack = input.stack;
    if (input.name) err.name = input.name;

    await logError(err, {
      url: input.url ?? req.headers.get('referer') ?? undefined,
      userAgent: input.userAgent ?? req.headers.get('user-agent') ?? undefined,
      source: input.source ?? 'client',
      extra: {
        digest: input.digest,
        componentStack: input.componentStack,
        ...(input.context ?? {}),
      },
    });

    return NextResponse.json({ ok: true });
  },
});
