import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/connect';
import {
  Integration,
  Workflow,
  WorkflowRun,
  type WorkflowRunStatus,
} from '@/lib/db/models';
import { NotFoundError } from '@/lib/errors';
import { logError } from '@/lib/tracking/log-error';
import { trackEvent } from '@/lib/tracking/event';
import { workflowDefinitionSchema, type Step } from './dsl';
import {
  getExecutor,
  type ExecutionContext,
  type StepResult,
} from './executors';
import { calculateRunCost } from './cost';

export interface ExecuteWorkflowInput {
  workflowId: string;
  runId: string;
  triggerData?: unknown;
}

/**
 * Run a workflow end-to-end against an existing `WorkflowRun` row.
 *
 * Lifecycle:
 *   1. Load Workflow + Run docs; verify ownership inferred from the Run.
 *   2. Re-parse the stored definition (defense against schema drift).
 *   3. Build initial `vars = { trigger: triggerData }`.
 *   4. Walk steps sequentially. After each success, expose its output as
 *      `vars[step.id]` so later steps can reference it.
 *   5. FAIL-FAST policy: first failed step → run status `'failure'`, loop
 *      stops, remaining steps are NOT executed (and not recorded). Per-step
 *      retry / continue-on-error policies are deferred to Phase 11.
 *   6. Persist results + bookkeeping (`durationMs`, `costUsd`) and increment
 *      the parent Workflow's `runCount` + `lastRun*` fields.
 *
 * Errors here NEVER throw to the caller — they're recorded on the Run doc.
 * That lets the HTTP handler treat `executeWorkflow` as fire-and-forget for
 * the inline (MVP) execution path.
 */
export async function executeWorkflow(input: ExecuteWorkflowInput): Promise<void> {
  await connectDb();
  const runId = new Types.ObjectId(input.runId);
  const workflowId = new Types.ObjectId(input.workflowId);

  const run = await WorkflowRun.findById(runId);
  if (!run) throw new NotFoundError('WorkflowRun not found.');

  const workflow = await Workflow.findOne({ _id: workflowId, userId: run.userId });
  if (!workflow) {
    await markFailure(run, 'WORKFLOW_NOT_FOUND', 'Workflow no longer exists.');
    return;
  }

  // Re-validate — `Workflow.definition` is Mixed, so we can't trust the
  // shape across schema migrations.
  const parsed = workflowDefinitionSchema.safeParse(workflow.definition);
  if (!parsed.success) {
    await markFailure(
      run,
      'INVALID_DEFINITION',
      'Stored workflow definition no longer matches the schema. Re-create the workflow.',
    );
    return;
  }
  const definition = parsed.data;

  // Snapshot the user's integration ids so executors can reject foreign
  // refs without hitting the DB per-step.
  const ownedDocs = await Integration.find({ userId: run.userId })
    .select('_id')
    .lean();
  const ownedIntegrationIds = new Set(ownedDocs.map((d) => String(d._id)));

  const startedAt = new Date();
  await WorkflowRun.updateOne(
    { _id: runId },
    { $set: { status: 'running' as WorkflowRunStatus, startedAt } },
  );

  const stepResults: StepResult[] = [];
  let runStatus: WorkflowRunStatus = 'success';
  let runError: { code: string; message: string } | null = null;

  const ctx: ExecutionContext = {
    userId: String(run.userId),
    ownedIntegrationIds,
    vars: { trigger: input.triggerData ?? run.triggerData ?? {} },
    runChild: runOne,
  };

  async function runOne(step: Step, childCtx: ExecutionContext): Promise<StepResult> {
    const executor = getExecutor(step.type);
    if (!executor) {
      const now = new Date();
      return {
        id: step.id,
        type: step.type,
        status: 'failure',
        error: {
          code: 'UNKNOWN_STEP_TYPE',
          message: `No executor registered for step type "${step.type}".`,
        },
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      };
    }
    return executor(step, childCtx);
  }

  for (const step of definition.steps) {
    const result = await runOne(step, ctx);
    stepResults.push(result);

    if (result.status === 'success' && result.output !== undefined) {
      ctx.vars[step.id] = result.output;
    }

    if (result.status === 'failure') {
      runStatus = 'failure';
      runError = result.error ?? {
        code: 'STEP_FAILED',
        message: `Step "${step.id}" failed.`,
      };
      // Fail-fast: subsequent steps are skipped, not recorded.
      break;
    }
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const costUsd = calculateRunCost(stepResults);

  await WorkflowRun.updateOne(
    { _id: runId },
    {
      $set: {
        status: runStatus,
        stepResults,
        completedAt,
        durationMs,
        costUsd,
        errorMessage: runError?.message,
        errorDetails: runError ? { code: runError.code } : undefined,
      },
    },
  );

  await Workflow.updateOne(
    { _id: workflowId },
    {
      $inc: { runCount: 1 },
      $set: {
        lastRunAt: completedAt,
        lastRunStatus: runStatus === 'success' ? 'success' : 'failure',
      },
    },
  );

  await trackEvent('workflow.run.completed', {
    userId: String(run.userId),
    workflowId,
    runId,
    properties: {
      status: runStatus,
      durationMs,
      costUsd,
      stepCount: stepResults.length,
    },
  }).catch((err) => logError(err, { source: 'executor.trackEvent' }));
}

/* ───────────────────────────── helpers ───────────────────────────── */

async function markFailure(
  run: { _id: Types.ObjectId },
  code: string,
  message: string,
): Promise<void> {
  const now = new Date();
  await WorkflowRun.updateOne(
    { _id: run._id },
    {
      $set: {
        status: 'failure' as WorkflowRunStatus,
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        errorMessage: message,
        errorDetails: { code },
        stepResults: [],
      },
    },
  );
}
