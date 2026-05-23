import type { StepResult } from './executors/types';

/**
 * Per-million-token prices for the Claude family we route through
 * OpenRouter. Update when models or prices change.
 *
 * Source: anthropic.com/pricing (May 2026). OpenRouter passes these
 * through verbatim plus their margin; values here are an approximation
 * good enough for in-app cost UX. Authoritative numbers live in the
 * OpenRouter dashboard's billing page.
 */
export const MODEL_PRICING: Record<
  string,
  { inputPerM: number; outputPerM: number }
> = {
  'anthropic/claude-sonnet-4.6': { inputPerM: 3, outputPerM: 15 },
  'anthropic/claude-opus-4.5': { inputPerM: 15, outputPerM: 75 },
  'anthropic/claude-haiku-4-5': { inputPerM: 1, outputPerM: 5 },
};

/** USD cost for an `ai.transform` call given token usage. */
export function costForUsage(
  modelId: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number {
  const price = MODEL_PRICING[modelId];
  if (!price) return 0;
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * price.inputPerM;
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * price.outputPerM;
  return round6(input + output);
}

/**
 * Recursively sum the `costUsd` field across all step results — walks into
 * `condition.if.branchResults` so nested AI calls aren't missed.
 */
export function calculateRunCost(results: StepResult[]): number {
  let total = 0;
  for (const r of results) {
    if (typeof r.costUsd === 'number') total += r.costUsd;
    if (r.branchResults) total += calculateRunCost(r.branchResults);
  }
  return round6(total);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
