import 'server-only';
import type { Step } from '../dsl';

/**
 * Per-step execution result. Persisted on `WorkflowRun.stepResults` so the
 * Run detail page can render the full input/output/error trail.
 *
 * `output` is shaped per executor (see each `executors/<name>.ts` file).
 * `branchResults` / `branchTaken` are only populated by `condition.if`.
 */
export interface StepResult {
  id: string;
  type: string;
  status: 'success' | 'failure' | 'skipped';
  /** Step config after template interpolation — handy for debugging. */
  resolvedConfig?: Record<string, unknown>;
  output?: unknown;
  error?: { code: string; message: string };
  /** USD cost incurred by this step (currently only `ai.transform`). */
  costUsd?: number;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  /** `condition.if`: results of steps executed in the chosen branch. */
  branchResults?: StepResult[];
  /** `condition.if`: which branch ran. */
  branchTaken?: 'then' | 'else' | 'none';
}

/**
 * Owner-scoped execution context passed to every executor. The
 * `ownedIntegrationIds` set lets each executor short-circuit on integration
 * IDs that don't belong to this user (defensive against tampered docs).
 */
export interface ExecutionContext {
  userId: string;
  ownedIntegrationIds: Set<string>;
  /**
   * Mutable variable bag: starts as `{ trigger: <triggerData> }` and gains
   * `<step.id>: <step.output>` after every successful step.
   */
  vars: Record<string, unknown>;
  /**
   * Recursively executes a child step. Wired by the main executor loop so
   * that `condition.if` can run its `then`/`else` branches without
   * importing the executor registry directly (avoids circular imports).
   */
  runChild: (step: Step, ctx: ExecutionContext) => Promise<StepResult>;
}

export type Executor<S extends Step = Step> = (
  step: S,
  ctx: ExecutionContext,
) => Promise<StepResult>;

/**
 * Sentinel thrown by individual executors when integration ownership /
 * existence checks fail. The main loop maps it to a clean failure status
 * without leaking stack traces.
 */
export class IntegrationOwnershipError extends Error {
  constructor(integrationId: string) {
    super(`Integration "${integrationId}" is not connected to this account.`);
    this.name = 'IntegrationOwnershipError';
  }
}

export function assertOwnsIntegration(
  ctx: ExecutionContext,
  integrationId: string,
): void {
  if (!ctx.ownedIntegrationIds.has(integrationId)) {
    throw new IntegrationOwnershipError(integrationId);
  }
}
