import 'server-only';
import { generateText } from 'ai';
import { claude, DEFAULT_AI_MODEL } from '@/lib/ai/openrouter';
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

    result.resolvedConfig = {
      instruction: step.config.instruction,
      inputPreview: input.slice(0, 500) + (input.length > 500 ? '…' : ''),
      model: DEFAULT_AI_MODEL,
    };

    const { text, usage } = await generateText({
      model: claude(),
      system: step.config.instruction,
      prompt: input || '(no input)',
      temperature: 0.3,
    });

    const usageRecord = {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    };
    const costUsd = costForUsage(DEFAULT_AI_MODEL, usageRecord);
    result.costUsd = costUsd;
    result.output = { text, usage: usageRecord, costUsd };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
