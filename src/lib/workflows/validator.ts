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
    idToType: new Map(),
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: parsed.data };
}

interface WalkCtx {
  options: ValidateOptions;
  errors: string[];
  seenIds: Set<string>;
  allowedRefs: Set<string>;
  /**
   * Map of step id → step type, so `checkTemplateRefs` can warn when a
   * downstream template references an `ai.transform` step bare
   * (`{{step}}` resolves to the WHOLE output object and gets
   * JSON-stringified into the next step's config — almost never what
   * the author wants; they meant `{{step.text}}`).
   */
  idToType: Map<string, Step['type']>;
}

function walk(steps: Step[], ctx: WalkCtx): void {
  for (const step of steps) {
    if (ctx.seenIds.has(step.id)) {
      ctx.errors.push(`Duplicate step id: "${step.id}"`);
    } else {
      ctx.seenIds.add(step.id);
    }
    ctx.idToType.set(step.id, step.type);

    checkIntegrationId(step, ctx);
    checkPlaceholderIds(step, ctx);
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

/**
 * The AI sometimes ignores the system prompt and emits placeholder strings
 * (`your_inbox_database_id`, `<channel_id>`, `YOUR_DATABASE_ID_HERE`)
 * instead of a real resource id. They pass shape validation — they're
 * strings — and only fail at runtime when Notion/Slack reject them.
 * Catch those here so a user-facing save error fires instead of a
 * silent landmine in production.
 */
const PLACEHOLDER_PATTERNS = [
  /^your_.*_id$/i,
  /^<.*_?id>$/i,
  /^YOUR_.*_(ID|HERE)$/,
  /placeholder/i,
  /^example_/i,
];

function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

function checkPlaceholderIds(step: Step, ctx: WalkCtx): void {
  if (step.type === 'notion.create_page') {
    const dbId = (step.config as { databaseId?: unknown }).databaseId;
    if (typeof dbId === 'string' && looksLikePlaceholder(dbId)) {
      ctx.errors.push(
        `Step "${step.id}": databaseId "${dbId}" looks like a placeholder. Replace it with a real Notion database id (share the database with the AutoMate integration in Notion first).`,
      );
    }
  }
  if (step.type === 'slack.post_message') {
    const channel = (step.config as { channel?: unknown }).channel;
    if (typeof channel === 'string' && looksLikePlaceholder(channel)) {
      ctx.errors.push(
        `Step "${step.id}": channel "${channel}" looks like a placeholder. Replace it with a real Slack channel id.`,
      );
    }
  }
  if (step.type === 'drive.create_folder' || step.type === 'drive.upload_file') {
    const folderId = (step.config as { folderId?: unknown }).folderId;
    if (typeof folderId === 'string' && looksLikePlaceholder(folderId)) {
      ctx.errors.push(
        `Step "${step.id}": folderId "${folderId}" looks like a placeholder. Replace it with a real Drive folder id or use folderName instead.`,
      );
    }
  }
}

function checkTemplateRefs(step: Step, ctx: WalkCtx): void {
  forEachTemplateRef(step, (ref) => {
    const trimmed = ref.trim();
    const root = trimmed.split('.')[0]?.split('[')[0];
    if (!root) return;
    if (!ctx.allowedRefs.has(root)) {
      ctx.errors.push(
        `Step "${step.id}": template "{{${ref}}}" refers to "${root}", which doesn't exist before this step.`,
      );
      return;
    }
    // Catch the common "I forgot .text" mistake on ai.transform outputs.
    // A bare `{{step_id}}` reference (no `.field` or `[index]`) resolves to
    // the WHOLE output object, which gets JSON-stringified downstream —
    // almost never what the author intended.
    const isBareReference = trimmed === root;
    if (isBareReference && ctx.idToType.get(root) === 'ai.transform') {
      ctx.errors.push(
        `Step "${step.id}": template "{{${root}}}" references the whole \`ai.transform\` output (token counts and all). Use "{{${root}.text}}" instead.`,
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
