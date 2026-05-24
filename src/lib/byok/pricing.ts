import type { ByokAiProvider } from '@/lib/db/models';

/**
 * Curated, demo-friendly model lists per provider. Bias toward the cheapest
 * models that still produce useful output — we don't want a curious visitor
 * to accidentally nuke their budget on `gpt-4.1` or `claude-opus-4`.
 *
 * Prices are USD per 1M tokens. Refresh from each provider's pricing page
 * periodically — the in-app picker reads them from here.
 *
 * Pricing pages:
 *   - OpenAI:     https://openai.com/api/pricing
 *   - Anthropic:  https://www.anthropic.com/pricing
 *   - DeepSeek:   https://api-docs.deepseek.com/quick_start/pricing
 *   - OpenRouter: https://openrouter.ai/models
 */
export interface ModelOption {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
}

export const AI_MODELS: Record<ByokAiProvider, ModelOption[]> = {
  openai: [
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano', inputPer1M: 0.1, outputPer1M: 0.4 },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', inputPer1M: 0.15, outputPer1M: 0.6 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', inputPer1M: 0.4, outputPer1M: 1.6 },
    { id: 'o3-mini', label: 'o3-mini', inputPer1M: 1.1, outputPer1M: 4.4 },
    { id: 'o1-mini', label: 'o1-mini', inputPer1M: 1.1, outputPer1M: 4.4 },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', inputPer1M: 1.0, outputPer1M: 5.0 },
    { id: 'claude-3-5-haiku-latest', label: 'Claude Haiku 3.5', inputPer1M: 0.8, outputPer1M: 4.0 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', inputPer1M: 3.0, outputPer1M: 15.0 },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat', inputPer1M: 0.14, outputPer1M: 0.28 },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', inputPer1M: 0.55, outputPer1M: 2.19 },
  ],
  openrouter: [
    { id: 'openrouter/auto', label: 'Auto (route to best)', inputPer1M: 0, outputPer1M: 0 },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', inputPer1M: 0.14, outputPer1M: 0.28 },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', inputPer1M: 0.13, outputPer1M: 0.4 },
    { id: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1', inputPer1M: 0.1, outputPer1M: 0.3 },
    { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', inputPer1M: 0.23, outputPer1M: 0.4 },
    { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', inputPer1M: 1.0, outputPer1M: 5.0 },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', inputPer1M: 0.15, outputPer1M: 0.6 },
  ],
};

/** First model in the per-provider list — the "if you don't pick, use this" default. */
export function defaultModelFor(provider: ByokAiProvider): string {
  return AI_MODELS[provider][0]!.id;
}
