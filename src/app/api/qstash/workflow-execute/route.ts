import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectDb } from '@/lib/db/connect';
import { Workflow, WorkflowRun, type WorkflowRunStatus } from '@/lib/db/models';
import { executeWorkflow } from '@/lib/workflows/executor';
import { verifyQStashSignature } from '@/lib/queue/qstash';
import { checkCanRunWorkflow } from '@/lib/usage/check-quota';
import { recordRunUsage } from '@/lib/usage/record-run';
import { logError } from '@/lib/tracking/log-error';
import { trackEvent } from '@/lib/tracking/event';

/**
 * QStash hands every workflow execution off here. Two payload shapes:
 *
 *   { workflowId, runId, triggerData? }   — manual run (runId already exists)
 *   { workflowId, scheduled: true }       — cron-triggered run (mint a fresh run)
 *
 * Signature verification is mandatory — without it any caller could
 * trigger runs as any user. Read raw body first, verify, then JSON-parse.
 */

const bodySchema = z.object({
  workflowId: z.string().min(1),
  runId: z.string().optional(),
  scheduled: z.boolean().optional(),
  triggerData: z.unknown().optional(),
});

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

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid payload.' } },
      { status: 400 },
    );
  }

  try {
    await connectDb();

    if (!Types.ObjectId.isValid(parsedBody.workflowId)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Workflow not found.' } },
        { status: 404 },
      );
    }
    const workflowObjectId = new Types.ObjectId(parsedBody.workflowId);
    const workflow = await Workflow.findById(workflowObjectId);
    if (!workflow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Workflow not found.' } },
        { status: 404 },
      );
    }

    // Resolve the run doc. Either it already exists (manual path) or we
    // mint a fresh one for the cron-scheduled path.
    let runId: Types.ObjectId;
    if (parsedBody.scheduled) {
      if (workflow.status !== 'active') {
        return NextResponse.json({ data: { skipped: 'inactive' } });
      }
      const gate = await checkCanRunWorkflow(String(workflow.userId));
      if (!gate.allowed) {
        // eslint-disable-next-line no-console
        console.warn('[qstash] scheduled run skipped — quota', {
          workflowId: String(workflowObjectId),
          userId: String(workflow.userId),
          reason: gate.reason,
        });
        return NextResponse.json({ data: { skipped: 'quota' } });
      }
      const run = await WorkflowRun.create({
        workflowId: workflowObjectId,
        userId: workflow.userId,
        status: 'queued' as WorkflowRunStatus,
        triggerData: parsedBody.triggerData ?? {},
      });
      runId = run._id;
      await trackEvent('workflow.run.started', {
        userId: String(workflow.userId),
        workflowId: workflowObjectId,
        runId: run._id,
        properties: { source: 'schedule' },
      }).catch(() => {});
    } else {
      if (!parsedBody.runId || !Types.ObjectId.isValid(parsedBody.runId)) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Missing runId.' } },
          { status: 400 },
        );
      }
      runId = new Types.ObjectId(parsedBody.runId);
    }

    await executeWorkflow({
      workflowId: String(workflowObjectId),
      runId: String(runId),
      triggerData: parsedBody.triggerData,
    });

    // Record usage AFTER execution. Failed runs still count toward quota
    // (same policy as Zapier). The meter event is idempotent on runId.
    await recordRunUsage({
      userId: String(workflow.userId),
      runId: String(runId),
    }).catch((err) => logError(err, { source: 'qstash.workflow-execute.recordUsage' }));

    return NextResponse.json({ data: { ok: true, runId: String(runId) } });
  } catch (err) {
    await logError(err, { source: 'qstash.workflow-execute' });
    // eslint-disable-next-line no-console
    console.error('[qstash.workflow-execute] handler crash', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not execute the run.' } },
      { status: 500 },
    );
  }
}
