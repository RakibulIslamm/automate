import { z } from 'zod';
import jsep from 'jsep';
import {
  workflowDefinitionSchema,
  type ConditionIfStep,
  type Step,
  type WorkflowDefinition,
} from './dsl';

/**
 * Two-pass workflow validator:
 *
 *   1. **Shape:** Zod parses the input against `workflowDefinitionSchema`.
 *      Any failure short-circuits with formatted messages.
 *   2. **Semantics:** Walk the parsed definition checking
 *        - step ids are unique (across all branches),
 *        - every `integrationId` referenced in step configs belongs to the
 *          caller's set of valid ids,
 *        - every `{{step_id.path}}` template references a step that
 *          executes *before* the current one (siblings count; descendants
 *          of an earlier `condition.if` branch do NOT — branch outputs
 *          don't survive the branch),
 *        - `condition.if` expressions parse.
 *
 * The whole thing returns a tagged union — callers don't have to remember
 * which level threw.
 */

export interface ValidateOptions {
  /** Set of integration ids the caller already verified belong to the user. */
  validIntegrationIds?: ReadonlySet<string>;
}

export type ValidateWorkflowResult =
  | { ok: true; data: WorkflowDefinition }
  | { ok: false; errors: string[] };

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export function validateWorkflow(
  definition: unknown,
  options: ValidateOptions = {},
): ValidateWorkflowResult {
  const parsed = workflowDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  const errors: string[] = [];
  const seenIds = new Set<string>();
  const allowedRefs = new Set<string>(['trigger']);

  walk(parsed.data.steps, {
    options,
    errors,
    seenIds,
    allowedRefs,
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: parsed.data };
}

interface WalkCtx {
  options: ValidateOptions;
  errors: string[];
  seenIds: Set<string>;
  allowedRefs: Set<string>;
}

function walk(steps: Step[], ctx: WalkCtx): void {
  for (const step of steps) {
    if (ctx.seenIds.has(step.id)) {
      ctx.errors.push(`Duplicate step id: "${step.id}"`);
    } else {
      ctx.seenIds.add(step.id);
    }

    checkIntegrationId(step, ctx);
    checkTemplateRefs(step, ctx);

    if (step.type === 'condition.if') {
      // Validate the expression parses; missing `{{refs}}` are fine — they
      // resolve to null at runtime, which is the documented behavior.
      const expr = (step as ConditionIfStep).config.expression;
      try {
        jsep(expr.replace(TEMPLATE_RE, 'null'));
      } catch (err) {
        ctx.errors.push(
          `Step "${step.id}": invalid expression — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      // Each branch sees the refs available *before* the condition, plus
      // the condition's own id (whose "output" is the boolean result), but
      // sibling branch ids are NOT shared. We snapshot/restore allowedRefs.
      const snapshot = new Set(ctx.allowedRefs);
      ctx.allowedRefs.add(step.id);
      walk(step.config.then, ctx);
      ctx.allowedRefs = new Set(snapshot);
      ctx.allowedRefs.add(step.id);
      if (step.config.else) walk(step.config.else, ctx);
      ctx.allowedRefs = new Set(snapshot);
      ctx.allowedRefs.add(step.id);
    } else {
      ctx.allowedRefs.add(step.id);
    }
  }
}

function checkIntegrationId(step: Step, ctx: WalkCtx): void {
  const integrationId = readIntegrationId(step);
  if (!integrationId) return;
  const allowed = ctx.options.validIntegrationIds;
  if (allowed && !allowed.has(integrationId)) {
    ctx.errors.push(
      `Step "${step.id}": integrationId "${integrationId}" doesn't belong to this user.`,
    );
  }
}

function readIntegrationId(step: Step): string | undefined {
  if (step.type === 'condition.if' || step.type === 'ai.transform') return undefined;
  const config = step.config as { integrationId?: unknown };
  return typeof config.integrationId === 'string' ? config.integrationId : undefined;
}

function checkTemplateRefs(step: Step, ctx: WalkCtx): void {
  forEachTemplateRef(step, (ref) => {
    const root = ref.split('.')[0]?.split('[')[0];
    if (!root) return;
    if (!ctx.allowedRefs.has(root)) {
      ctx.errors.push(
        `Step "${step.id}": template "{{${ref}}}" refers to "${root}", which doesn't exist before this step.`,
      );
    }
  });
}

/**
 * Visit every `{{path}}` reference inside a step's config (including the
 * expression of `condition.if` steps). Does NOT descend into `then`/`else`
 * branches — those are walked separately by `walk`.
 */
function forEachTemplateRef(step: Step, visit: (path: string) => void): void {
  if (step.type === 'condition.if') {
    findRefsInString((step as ConditionIfStep).config.expression, visit);
    return;
  }
  // Iterate every primitive string under config and pull refs out.
  scanForStrings(step.config, (s) => findRefsInString(s, visit));
}

function findRefsInString(input: string, visit: (path: string) => void): void {
  if (!input) return;
  for (const m of input.matchAll(TEMPLATE_RE)) {
    const path = m[1]?.trim();
    if (path) visit(path);
  }
}

function scanForStrings(value: unknown, onString: (s: string) => void): void {
  if (typeof value === 'string') {
    onString(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) scanForStrings(v, onString);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      scanForStrings(v, onString);
    }
  }
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${path}: ${issue.message}`;
  });
}
