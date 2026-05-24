import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { connectDb } from '@/lib/db/connect';
import { Workflow, WorkflowRun } from '@/lib/db/models';
import { executeWorkflow } from '@/lib/workflows/executor';
import { listEmails, getMessage } from '@/lib/integrations/gmail';
import type { WorkflowDefinition } from '@/lib/workflows/dsl';
import { enqueueWorkflowRun } from '@/lib/queue/qstash';
import { trackEvent } from '@/lib/tracking/event';
import { logError } from '@/lib/tracking/log-error';

const MANUAL_BACKFILL_LIMIT = 10;

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

    const definition = workflow.definition as WorkflowDefinition;
    const explicitTriggerData = isExplicitTriggerData(body.triggerData) ? body.triggerData : null;

    // Special path: Gmail-triggered workflow with no explicit triggerData →
    // backfill the most recent matching emails (up to MANUAL_BACKFILL_LIMIT),
    // creating one run per email so the user sees one Notion page per email.
    // Same idea as Zapier's "Replay" / batch backfill button.
    if (explicitTriggerData == null && definition.trigger.type === 'gmail.email_received') {
      const samples = await hydrateGmailSamples(definition, MANUAL_BACKFILL_LIMIT);
      if (samples.length > 0) {
        const runIds = await enqueueRuns(workflowId, userId, samples);
        return NextResponse.json({
          data: { runId: runIds[0], runIds, batched: runIds.length },
        });
      }
      // No matching emails — fall through to a single empty-data run so the
      // user still sees a (likely-failing) run record they can inspect.
    }

    // Default path: single run, hydrate sample data if the body was empty
    // and the trigger has a hydratable type.
    const triggerData =
      explicitTriggerData ?? (await hydrateSampleTriggerData(definition));

    const run = await WorkflowRun.create({
      workflowId,
      userId,
      status: 'queued',
      triggerData: triggerData ?? {},
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
      triggerData,
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

/**
 * Distinguish "user passed real triggerData" from "user passed nothing"
 * (or an empty object). The Run-now button always sends `{}`; explicit
 * re-runs from a previous run's data send the original payload.
 */
function isExplicitTriggerData(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'object') return true;
  return Object.keys(value as object).length > 0;
}

/**
 * Build a triggerData payload for trigger types that normally fire from
 * external events. Manual runs have no real event behind them, so we
 * fetch a recent matching item from the source as "sample data" — same
 * pattern Zapier's "Test trigger" uses.
 *
 * Returns `{}` for trigger types we can't (or don't need to) hydrate —
 * the executor falls back to that and template refs render as empty.
 */
async function hydrateSampleTriggerData(definition: WorkflowDefinition): Promise<unknown> {
  const trigger = definition.trigger;
  if (trigger.type !== 'gmail.email_received') return {};
  const samples = await hydrateGmailSamples(definition, 1);
  return samples[0] ?? {};
}

/**
 * Fetch up to `limit` matching emails and build a triggerData payload
 * per message — `{ message: { id, subject, from, ... } }`. Used by the
 * Gmail backfill path of manual runs. Failures don't throw; the caller
 * gets an empty array and falls back to the single-empty-run flow.
 */
async function hydrateGmailSamples(
  definition: WorkflowDefinition,
  limit: number,
): Promise<unknown[]> {
  if (definition.trigger.type !== 'gmail.email_received') return [];
  const { integrationId, query } = definition.trigger.config;
  try {
    const messages = await listEmails(integrationId, { query, maxResults: limit });
    if (messages.length === 0) return [];
    const settled = await Promise.allSettled(
      messages.map(async (m): Promise<unknown | null> => {
        if (!m.id) return null;
        const msg = await getMessage(integrationId, m.id);
        return { message: messageToMeta(msg, m.id) };
      }),
    );
    const out: unknown[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value !== null) out.push(s.value);
    }
    return out;
  } catch (err) {
    await logError(err, { source: 'api.workflows.run.hydrate' });
    return [];
  }
}

/**
 * Create a `WorkflowRun` per `triggerData` entry and enqueue each one
 * to QStash. Returns the new run ids in the same order so the caller
 * can redirect to the first one (and the UI can show the batched count).
 */
async function enqueueRuns(
  workflowId: Types.ObjectId,
  userId: string,
  triggerDataList: unknown[],
): Promise<string[]> {
  const runIds: string[] = [];
  for (const triggerData of triggerDataList) {
    const run = await WorkflowRun.create({
      workflowId,
      userId,
      status: 'queued',
      triggerData: triggerData ?? {},
    });
    await trackEvent('workflow.run.started', {
      userId,
      workflowId,
      runId: run._id,
      properties: { source: 'manual', batched: true },
    }).catch(() => {});
    try {
      await enqueueWorkflowRun({
        workflowId: String(workflowId),
        runId: String(run._id),
        triggerData,
      });
    } catch (err) {
      // If QStash is unhappy, the run row still exists in 'queued' state
      // — the user sees it and we log the enqueue failure separately.
      await logError(err, {
        source: 'api.workflows.run.enqueue',
        extra: { runId: String(run._id) },
      });
    }
    runIds.push(String(run._id));
  }
  return runIds;
}

/**
 * Pull the fields the rest of the system expects out of a Gmail message
 * — used by both the manual-run hydrator and the cron-poller. Keeps the
 * `triggerData.message` shape consistent across both paths.
 */
function messageToMeta(
  msg: Awaited<ReturnType<typeof getMessage>>,
  fallbackId: string,
): {
  id: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
  snippet: string | null;
  receivedAt: string | null;
} {
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
  const internalDateMs = msg.internalDate ? Number(msg.internalDate) : null;
  return {
    id: msg.id ?? fallbackId,
    threadId: msg.threadId ?? null,
    subject: header('Subject'),
    from: header('From'),
    to: header('To'),
    snippet: msg.snippet ?? null,
    receivedAt:
      internalDateMs && Number.isFinite(internalDateMs)
        ? new Date(internalDateMs).toISOString()
        : null,
  };
}
