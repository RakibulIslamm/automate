import 'server-only';
import { ExternalServiceError } from '@/lib/errors';
import { interpolate, interpolateValue } from '../interpolate';
import type { ExecutionContext, StepResult } from './types';

/**
 * Tiny utilities every executor uses. Keeps the per-step files small —
 * they should focus on the integration call, not bookkeeping.
 */

/** Type-safe single-string template resolution. */
export function resolveString(template: string, ctx: ExecutionContext): string {
  return interpolate(template, ctx.vars);
}

/** Recursive resolution for object/array configs (notion.create_page). */
export function resolveValue<T>(value: T, ctx: ExecutionContext): unknown {
  return interpolateValue(value, ctx.vars);
}

/**
 * Build the empty-shell result the executor returns on success or
 * failure. Executors patch `output`/`error`/`status` then call
 * `finalize(result, started)` to set timing.
 */
export function startResult(stepId: string, stepType: string): {
  result: StepResult;
  startedAt: Date;
} {
  const startedAt = new Date();
  const result: StepResult = {
    id: stepId,
    type: stepType,
    status: 'success',
    startedAt,
    completedAt: startedAt,
    durationMs: 0,
  };
  return { result, startedAt };
}

export function finalize(result: StepResult, startedAt: Date): StepResult {
  const completedAt = new Date();
  result.completedAt = completedAt;
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  return result;
}

/**
 * Wrap an executor's main try block. On thrown errors we convert to a
 * failure result with structured `error` so the run-detail page can render
 * a friendly message. We special-case `ExternalServiceError` to preserve
 * the originating service name.
 */
export function failFromError(
  result: StepResult,
  startedAt: Date,
  err: unknown,
): StepResult {
  result.status = 'failure';
  if (err instanceof ExternalServiceError) {
    result.error = {
      code: `${err.service.toUpperCase()}_ERROR`,
      message: err.publicMessage,
    };
  } else if (err instanceof Error) {
    result.error = { code: err.name || 'STEP_ERROR', message: err.message };
  } else {
    result.error = { code: 'STEP_ERROR', message: 'Unknown step error.' };
  }
  return finalize(result, startedAt);
}
