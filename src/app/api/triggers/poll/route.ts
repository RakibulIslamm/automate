import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import { Workflow, WorkflowRun } from '@/lib/db/models';
import { getMessage, listEmails } from '@/lib/integrations/gmail';
import { verifyQStashSignature, enqueueWorkflowRun } from '@/lib/queue/qstash';
import { checkCanRunWorkflow } from '@/lib/usage/check-quota';
import { logError } from '@/lib/tracking/log-error';
import type { WorkflowDefinition } from '@/lib/workflows/dsl';

/**
 * Trigger poller. Called by a recurring QStash schedule (1-minute cadence
 * recommended). For each active `gmail.email_received` workflow:
 *
 *   1. List Gmail messages matching the user-provided query, filtered to
 *      anything newer than `workflow.lastRunAt` (or the last 5 min on first
 *      poll, so we don't blast through inbox history).
 *   2. For each new match: build a `triggerData = { message: { id, from, ... } }`
 *      shape, mint a `WorkflowRun` row, and queue an execution.
 *   3. Stamp `workflow.lastRunAt = now` so subsequent polls advance the
 *      cursor regardless of whether any messages matched this round.
 *
 * Per-workflow failures are isolated — one user's broken integration
 * never blocks anybody else's runs.
 */

const PER_POLL_LIMIT = 5;
const FIRST_POLL_LOOKBACK_MS = 5 * 60 * 1000;

interface GmailTriggerConfig {
  integrationId: string;
  query: string;
}

interface MessageMeta {
  id: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
  snippet: string | null;
  receivedAt: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('upstash-signature');
  const valid = await verifyQStashSignature({ signature, body: rawBody });
  if (!valid) {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Signature check failed.' } },
      { status: 401 },
    );
  }

  try {
    await connectDb();
    const workflows = await Workflow.find({
      status: 'active',
      scheduleType: 'event',
    }).lean();

    const summary: Array<{ workflowId: string; enqueued: number; skipped?: string }> = [];

    for (const wf of workflows) {
      const def = wf.definition as WorkflowDefinition | undefined;
      if (!def || def.trigger.type !== 'gmail.email_received') continue;

      try {
        const result = await pollOne({
          workflowId: String(wf._id),
          userId: String(wf.userId),
          trigger: def.trigger.config as GmailTriggerConfig,
          lastRunAt: wf.lastRunAt ? new Date(wf.lastRunAt) : null,
        });
        summary.push({ workflowId: String(wf._id), enqueued: result.enqueued, skipped: result.skipped });
        await Workflow.updateOne(
          { _id: wf._id },
          { $set: { lastRunAt: new Date() } },
        );
      } catch (err) {
        await logError(err, {
          source: 'triggers.poll.workflow',
          extra: { workflowId: String(wf._id) },
        });
      }
    }

    return NextResponse.json({ data: { polled: summary.length, summary } });
  } catch (err) {
    await logError(err, { source: 'triggers.poll' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Poll failed.' } },
      { status: 500 },
    );
  }
}

async function pollOne(input: {
  workflowId: string;
  userId: string;
  trigger: GmailTriggerConfig;
  lastRunAt: Date | null;
}): Promise<{ enqueued: number; skipped?: string }> {
  const cursorMs = (input.lastRunAt?.getTime() ?? Date.now() - FIRST_POLL_LOOKBACK_MS);

  // Gmail's `after:` operator takes UNIX-seconds; combine with the
  // user's query so we don't re-match stuff from before the cursor.
  const cursorSeconds = Math.floor(cursorMs / 1000);
  const userQuery = input.trigger.query?.trim();
  const finalQuery = [`after:${cursorSeconds}`, userQuery].filter(Boolean).join(' ');

  let listed;
  try {
    listed = await listEmails(input.trigger.integrationId, {
      query: finalQuery,
      maxResults: PER_POLL_LIMIT,
    });
  } catch (err) {
    await logError(err, {
      source: 'triggers.poll.listEmails',
      extra: { workflowId: input.workflowId },
    });
    return { enqueued: 0, skipped: 'integration_error' };
  }

  if (listed.length === 0) return { enqueued: 0 };

  // Quota gate — same check used by the manual run path.
  const gate = await checkCanRunWorkflow(input.userId);
  if (!gate.allowed) return { enqueued: 0, skipped: 'quota' };

  let enqueued = 0;
  for (const m of listed) {
    if (!m.id) continue;
    let meta: MessageMeta;
    try {
      meta = await fetchMessageMeta(input.trigger.integrationId, m.id);
    } catch (err) {
      await logError(err, {
        source: 'triggers.poll.getMessage',
        extra: { workflowId: input.workflowId },
      });
      continue;
    }

    // Skip if we somehow get a message that pre-dates the cursor (Gmail's
    // `after:` is fuzzy on internalDate).
    if (meta.receivedAt) {
      const receivedMs = new Date(meta.receivedAt).getTime();
      if (Number.isFinite(receivedMs) && receivedMs <= cursorMs) continue;
    }

    const run = await WorkflowRun.create({
      workflowId: new Types.ObjectId(input.workflowId),
      userId: new Types.ObjectId(input.userId),
      status: 'queued',
      triggerData: { message: meta },
    });

    try {
      await enqueueWorkflowRun({
        workflowId: input.workflowId,
        runId: String(run._id),
        triggerData: { message: meta },
      });
      enqueued += 1;
    } catch (err) {
      await logError(err, {
        source: 'triggers.poll.enqueue',
        extra: { workflowId: input.workflowId, runId: String(run._id) },
      });
    }
  }

  return { enqueued };
}

async function fetchMessageMeta(
  integrationId: string,
  messageId: string,
): Promise<MessageMeta> {
  const msg = await getMessage(integrationId, messageId);
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
  const internalDateMs = msg.internalDate ? Number(msg.internalDate) : null;
  return {
    id: msg.id ?? messageId,
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
