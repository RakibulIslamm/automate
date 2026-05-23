import 'server-only';
import { generateText } from 'ai';
import { z } from 'zod';
import { claude } from '@/lib/ai/openrouter';
import { workflowDefinitionSchema, type WorkflowDefinition } from './dsl';
import { validateWorkflow } from './validator';
import { buildSystemPrompt, type AvailableIntegration } from '@/lib/ai/prompts/workflow-builder';
import { WorkflowExecutionError } from '@/lib/errors';
import { logError } from '@/lib/tracking/log-error';

/**
 * Schema we ask the model to produce. Extends the canonical workflow schema
 * with `suggestedName` + `suggestedDescription` so we get both the
 * machine-readable definition and human-friendly UI copy in one call.
 *
 * NOTE: we deliberately allow `name`/`description` inside `definition` to be
 * absent — the AI returns the friendly copy via `suggestedName`/`suggestedDescription`
 * at the top level. Keeping both layers (rather than collapsing) makes it easy
 * to override either in the UI without touching the canonical workflow doc.
 */
const aiResultSchema = z.object({
  suggestedName: z.string().min(1).max(80),
  suggestedDescription: z.string().min(1).max(200),
  definition: workflowDefinitionSchema,
});

export type AiBuilderResult = {
  definition: WorkflowDefinition;
  suggestedName: string;
  suggestedDescription: string;
};

export interface BuildWorkflowInput {
  userPrompt: string;
  userId: string;
  availableIntegrations: AvailableIntegration[];
}

const MAX_ATTEMPTS = 2;

/**
 * Turn a plain-English request into a structured WorkflowDefinition.
 *
 * Flow:
 *   1. `generateText` with a "respond with raw JSON only" system prompt.
 *      We deliberately AVOID `generateObject` because it sends
 *      `response_format: json_schema`, which budget models (DeepSeek flash,
 *      some open-weight providers) reject with an upstream 503. The raw
 *      text path works on any model that can spit out JSON in a code-fence.
 *   2. Strip optional markdown fences and parse → validate against the Zod
 *      schema.
 *   3. Run our semantic validator (integration ids, ref scoping,
 *      condition.if expressions).
 *   4. If either parsing or validation fails: retry once with the errors
 *      fed back to the model as a user-turn correction. If that also fails:
 *      throw `WorkflowExecutionError` so the API route surfaces a friendly
 *      toast (and logs the detail server-side).
 */
export async function buildWorkflowFromPrompt(
  input: BuildWorkflowInput,
): Promise<AiBuilderResult> {
  const system = buildSystemPrompt({
    availableIntegrations: input.availableIntegrations,
  });
  const validIntegrationIds = new Set(input.availableIntegrations.map((i) => i.id));

  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const messages = buildMessages({
      userPrompt: input.userPrompt,
      attempt,
      lastErrors,
    });

    let text: string;
    try {
      const result = await generateText({
        model: claude(),
        system: `${system}\n\n# Output format\n\nReturn ONE valid JSON object — no prose, no markdown fences. The JSON MUST have exactly these top-level keys:\n  - "suggestedName" (string, ≤ 80 chars)\n  - "suggestedDescription" (string, ≤ 200 chars)\n  - "definition" (the WorkflowDefinition described above)\n\nIf you wrap the JSON in a code fence we strip it, but unfenced raw JSON is preferred.`,
        messages,
        temperature: 0.2,
      });
      text = result.text;
    } catch (err) {
      await logError(err, {
        source: 'ai-builder.generateText',
        userId: input.userId,
        extra: { attempt, userPrompt: input.userPrompt.slice(0, 500) },
      });
      throw new WorkflowExecutionError(friendlyAiErrorMessage(err), undefined, err);
    }

    const parsed = tryParseAiResult(text);
    if (!parsed.ok) {
      lastErrors = [parsed.error];
      if (attempt === MAX_ATTEMPTS) {
        await logError(new Error('AI builder JSON parse failed after retries'), {
          source: 'ai-builder.parse',
          userId: input.userId,
          extra: {
            parseError: parsed.error,
            // Trim the raw response so we don't blow up the ErrorLog doc.
            rawTextPreview: text.slice(0, 1000),
            userPrompt: input.userPrompt.slice(0, 500),
          },
        });
        throw new WorkflowExecutionError(
          "Couldn't generate a valid workflow from your description. Try being more specific.",
        );
      }
      continue;
    }

    const raw = parsed.data;

    // "Missing integration" sentinel — model returned an empty-steps workflow
    // and tagged the name accordingly. Skip semantic validation (it would
    // succeed but the user still needs to act).
    if (raw.definition.steps.length === 0) {
      return {
        definition: raw.definition,
        suggestedName: raw.suggestedName,
        suggestedDescription: raw.suggestedDescription,
      };
    }

    const semantic = validateWorkflow(raw.definition, { validIntegrationIds });
    if (semantic.ok) {
      return {
        definition: semantic.data,
        suggestedName: raw.suggestedName,
        suggestedDescription: raw.suggestedDescription,
      };
    }

    lastErrors = semantic.errors;
    if (attempt === MAX_ATTEMPTS) {
      await logError(new Error('Workflow failed validation after retries'), {
        source: 'ai-builder.validate',
        userId: input.userId,
        extra: { errors: semantic.errors, userPrompt: input.userPrompt.slice(0, 500) },
      });
      throw new WorkflowExecutionError(
        "Couldn't generate a valid workflow from your description. Try being more specific.",
      );
    }
  }

  // Unreachable — the for loop either returns or throws.
  throw new WorkflowExecutionError(
    "Couldn't generate a valid workflow from your description.",
  );
}

/**
 * Parse the AI's text response into the result schema. Handles three
 * variants we've seen in the wild:
 *   1. Pure JSON object (the happy path).
 *   2. JSON wrapped in a ```json ... ``` fence (Claude does this sometimes).
 *   3. JSON with surrounding chatter — we extract the first balanced
 *      `{...}` block.
 */
function tryParseAiResult(
  text: string,
): { ok: true; data: z.infer<typeof aiResultSchema> } | { ok: false; error: string } {
  const cleaned = stripFences(text).trim();
  const jsonBlob = extractFirstJsonObject(cleaned);
  if (!jsonBlob) {
    return { ok: false, error: 'Model response did not contain a JSON object.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlob);
  } catch (err) {
    return {
      ok: false,
      error: `Model response was not valid JSON: ${(err as Error).message}`,
    };
  }
  const result = aiResultSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `Model response did not match the workflow schema: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '_root'}: ${i.message}`)
        .join('; ')}`,
    };
  }
  return { ok: true, data: result.data };
}

function stripFences(text: string): string {
  // ```json ... ``` or ``` ... ```
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match?.[1] ?? text;
}

/**
 * Scan for the first balanced `{...}` block. Handles strings (so a `}`
 * inside a quoted value doesn't terminate the scan early) without pulling
 * in a full JSON parser.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Map OpenRouter / AI SDK failures to user-facing toast copy.
 *
 * Important: the public message must NEVER mention env var names, file
 * paths, or admin-level instructions ("restart the dev server", "top up
 * credits"). Those are operator concerns and belong in the server log
 * only — see `logError` above this call site. Users see a generic message;
 * the developer reading the terminal sees the specific status code + body.
 */
function friendlyAiErrorMessage(err: unknown): string {
  const apiError = err as { statusCode?: number };
  if (apiError?.statusCode === 429) {
    return 'Too many requests right now. Please wait a moment and try again.';
  }
  return 'The AI builder is unavailable right now. Please try again shortly.';
}

function buildMessages({
  userPrompt,
  attempt,
  lastErrors,
}: {
  userPrompt: string;
  attempt: number;
  lastErrors: string[];
}) {
  if (attempt === 1) {
    return [{ role: 'user' as const, content: userPrompt }];
  }
  return [
    { role: 'user' as const, content: userPrompt },
    {
      role: 'user' as const,
      content:
        `Your previous response failed validation with these errors:\n` +
        lastErrors.map((e) => `- ${e}`).join('\n') +
        `\n\nFix them and emit a new valid workflow definition. Same request as above.`,
    },
  ];
}
