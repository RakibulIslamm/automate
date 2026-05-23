import 'server-only';
import { generateObject } from 'ai';
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
 *   1. `generateObject` with the workflow schema + system prompt.
 *   2. Run our own validator (which checks integration ids, ref scoping,
 *      condition.if expressions).
 *   3. If validation fails: retry once with the errors fed back to the model
 *      as a user-turn correction. If that also fails: throw
 *      `WorkflowExecutionError` so the API route surfaces a friendly toast.
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

    let raw: z.infer<typeof aiResultSchema>;
    try {
      const { object } = await generateObject({
        model: claude(),
        schema: aiResultSchema,
        system,
        messages,
        temperature: 0.2,
      });
      raw = object;
    } catch (err) {
      await logError(err, {
        source: 'ai-builder.generateObject',
        userId: input.userId,
        extra: { attempt, userPrompt: input.userPrompt.slice(0, 500) },
      });
      throw new WorkflowExecutionError(
        friendlyAiErrorMessage(err),
        undefined,
        err,
      );
    }

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
