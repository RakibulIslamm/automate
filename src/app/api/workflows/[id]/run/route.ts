import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { connectDb } from '@/lib/db/connect';
import { Workflow, WorkflowRun } from '@/lib/db/models';
import { executeWorkflow } from '@/lib/workflows/executor';
import { trackEvent } from '@/lib/tracking/event';
import { logError } from '@/lib/tracking/log-error';

/**
 * POST /api/workflows/[id]/run — kicks off a manual workflow run.
 *
 * MVP behaviour: synchronous inline execution. The handler creates the
 * `WorkflowRun` row first, returns the runId immediately, then awaits the
 * executor. In dev (Node) this is fine — the user sees a "running" page
 * briefly and the page re-renders complete on next visit. On Vercel the
 * 60 s function timeout will bite long workflows; Phase 11 swaps this for
 * a QStash hand-off.
 *
 * NOT using `safeRoute` here because we want fine-grained control over
 * the order: respond → then execute. With `safeRoute` the response is
 * returned after the handler resolves, which would mean waiting for the
 * full run.
 */

const bodySchema = z
  .object({
    triggerData: z.unknown().optional(),
  })
  .default({});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let userId: string;
  try {
    const user = await requireUser();
    userId = String(user._id);
  } catch (err) {
    return jsonError('UNAUTHORIZED', 'You must be signed in.', 401);
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return jsonError('NOT_FOUND', 'Workflow not found.', 404);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError('VALIDATION_ERROR', 'Invalid request body.', 400);
    }
    throw err;
  }

  try {
    await connectDb();
    const workflowId = new Types.ObjectId(id);
    const workflow = await Workflow.findOne({ _id: workflowId, userId });
    if (!workflow) throw new NotFoundError('Workflow not found.');

    const run = await WorkflowRun.create({
      workflowId,
      userId,
      status: 'queued',
      triggerData: body.triggerData ?? {},
    });

    await trackEvent('workflow.run.started', {
      userId,
      workflowId,
      runId: run._id,
      properties: { source: 'manual' },
    }).catch(() => {});

    // Inline await — see file-level comment about Vercel limits.
    await executeWorkflow({
      workflowId: String(workflowId),
      runId: String(run._id),
      triggerData: body.triggerData,
    });

    return NextResponse.json({ data: { runId: String(run._id) } });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError(err.code, err.publicMessage, err.statusCode);
    }
    if (err instanceof ValidationError) {
      return jsonError(err.code, err.publicMessage, err.statusCode);
    }
    await logError(err, { source: 'api.workflows.run', userId });
    return jsonError('INTERNAL_ERROR', 'Something went wrong starting the run.', 500);
  }
}

function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}
