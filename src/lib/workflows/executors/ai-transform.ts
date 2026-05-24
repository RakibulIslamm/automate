import 'server-only';
import { generateText } from 'ai';
import { getActiveAi } from '@/lib/byok/get-active-ai';
import { reserveDemoAiCall } from '@/lib/byok/rate-limit';
import { env } from '@/lib/env';
import { ExternalServiceError } from '@/lib/errors';
import type { StepOfType } from '../dsl';
import { type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';
import { costForUsage } from '../cost';

/**
 * Run a free-form Claude call against context data. `inputFrom` resolves
 * (often via a sole `{{…}}` template, which preserves typed values) to a
 * string, object, or array — we stringify non-strings before handing to
 * the model.
 *
 * Output: `{ text, costUsd, usage }`. The token usage is attached so the
 * Run detail page can show a per-step breakdown.
 */
export const executeAiTransform: Executor<StepOfType<'ai.transform'>> = async (step, ctx) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    const inputRaw = resolveString(step.config.inputFrom, ctx);
    const input =
      // `resolveString` always returns a string — but if the user passed a
      // sole `{{…}}` template that resolved to an object we want pretty
      // JSON, not the `[object Object]` you'd get otherwise. Detect that
      // case by re-running through interpolateValue logic here.
      inputRaw.length === 0 ? '' : inputRaw;

    const ai = await getActiveAi(ctx.userId);
    if (ai.source === 'platform' && env.BYOK_ENABLE) {
      const gate = await reserveDemoAiCall(ctx.userId);
      if (!gate.allowed) {
        throw new ExternalServiceError(
          'AI',
          `Daily demo limit reached (${gate.cap} AI calls). Add your own API key in Settings → AI provider to keep going.`,
        );
      }
    }

    result.resolvedConfig = {
      instruction: step.config.instruction,
      inputPreview: input.slice(0, 500) + (input.length > 500 ? '…' : ''),
      model: ai.modelId,
      source: ai.source,
    };

    const { text, usage } = await generateText({
      model: ai.model,
      system: step.config.instruction,
      prompt: input || '(no input)',
      temperature: 0.3,
    });

    const usageRecord = {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    };
    const costUsd = costForUsage(ai.modelId, usageRecord);
    result.costUsd = costUsd;
    result.output = { text, usage: usageRecord, costUsd };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
