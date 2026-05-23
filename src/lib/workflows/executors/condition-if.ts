import 'server-only';
import type { ConditionIfStep, Step } from '../dsl';
import { evaluateExpression } from '../interpolate';
import { type Executor, type StepResult } from './types';
import { failFromError, finalize, startResult } from './_shared';

/**
 * Branches based on a boolean expression. Evaluation:
 *   1. Substitute `{{...}}` refs in the expression with JSON-encoded
 *      literals from `ctx.vars`.
 *   2. Parse + evaluate via the jsep-based safe evaluator.
 *   3. Pick the matching branch (`then` or `else`), then sequentially run
 *      each child step via `ctx.runChild`. If any child step fails,
 *      branch execution stops and the parent step is also marked
 *      `failure` — same fail-fast policy as the top-level loop.
 */
export const executeConditionIf: Executor<ConditionIfStep> = async (step, ctx) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    const evaluated = evaluateExpression(step.config.expression, ctx.vars);
    result.resolvedConfig = {
      expression: step.config.expression,
      evaluated: evaluated.value,
      parseError: evaluated.error,
    };
    if (evaluated.error) {
      throw new Error(`Expression error: ${evaluated.error}`);
    }

    const branch: Step[] | undefined = evaluated.value
      ? step.config.then
      : step.config.else;
    result.branchTaken = evaluated.value ? 'then' : step.config.else ? 'else' : 'none';

    const branchResults: StepResult[] = [];
    if (branch && branch.length > 0) {
      for (const child of branch) {
        const childResult = await ctx.runChild(child, ctx);
        branchResults.push(childResult);

        if (childResult.status === 'success' && childResult.output !== undefined) {
          ctx.vars[child.id] = childResult.output;
        }
        if (childResult.status === 'failure') {
          result.status = 'failure';
          result.error = {
            code: 'BRANCH_STEP_FAILED',
            message: `Branch step "${child.id}" failed: ${childResult.error?.message ?? 'unknown error'}`,
          };
          result.branchResults = branchResults;
          return finalize(result, startedAt);
        }
      }
    }

    result.branchResults = branchResults;
    result.output = {
      branchTaken: result.branchTaken,
      stepsRun: branchResults.length,
    };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
