import 'server-only';
import { Types } from 'mongoose';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { connectDb } from '@/lib/db/connect';
import { ByokKey, type ByokAiProvider, type ByokKeyDoc } from '@/lib/db/models';
import { decrypt } from '@/lib/crypto';
import { env } from '@/lib/env';
import { ByokKeyRequiredError, ExternalServiceError } from '@/lib/errors';
import { defaultModelFor } from './pricing';

/**
 * Resolve the active AI model + key for a user. The single chokepoint every
 * AI call must go through, so BYOK / production routing lives in exactly
 * one place.
 *
 * Resolution order:
 *   1. User has a saved BYOK key for any AI provider → use it.
 *   2. `BYOK_ENABLE=false` (production) → use the platform OpenRouter key.
 *   3. `BYOK_ENABLE=true` and the user has no BYOK key → throw
 *      `BYOK_KEY_REQUIRED`. The caller is responsible for surfacing the
 *      "go to Settings and add a key" UI.
 *
 * The returned `source` lets the caller stamp run-detail badges
 * ("Run with your key" vs "Run on platform credits").
 */

export type ActiveAiSource = 'byok' | 'platform';

export interface ActiveAi {
  source: ActiveAiSource;
  provider: ByokAiProvider | 'openrouter';
  model: LanguageModel;
  /** The model id sent over the wire — useful for cost stamping in logs. */
  modelId: string;
}

export async function getActiveAi(userId: string): Promise<ActiveAi> {
  await connectDb();
  const byok = await ByokKey.findOne({
    userId: new Types.ObjectId(userId),
    provider: { $in: ['openai', 'anthropic', 'openrouter', 'deepseek'] },
    status: { $in: ['untested', 'active'] },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (byok) return buildByokAi(byok);

  // No user key — fall back to the platform key if production mode allows.
  if (env.BYOK_ENABLE) {
    throw new ByokKeyRequiredError('ai');
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new ExternalServiceError(
      'AI',
      'AI is not configured on the server. Try again later.',
    );
  }
  return buildPlatformAi();
}

function buildByokAi(doc: ByokKeyDoc): ActiveAi {
  const provider = doc.provider as ByokAiProvider;
  const key = decrypt(doc.encryptedKey);
  const modelId = doc.selectedModel ?? defaultModelFor(provider);

  switch (provider) {
    case 'openai': {
      const sdk = createOpenAI({ apiKey: key });
      return { source: 'byok', provider, model: sdk.chat(modelId), modelId };
    }
    case 'anthropic': {
      const sdk = createAnthropic({ apiKey: key });
      return { source: 'byok', provider, model: sdk(modelId), modelId };
    }
    case 'deepseek': {
      // DeepSeek is OpenAI-compatible — reuse the OpenAI provider with a
      // different baseURL rather than pulling in a fourth SDK.
      const sdk = createOpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
      return { source: 'byok', provider, model: sdk.chat(modelId), modelId };
    }
    case 'openrouter': {
      const sdk = createOpenRouter({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        appName: 'AutoMate (BYOK)',
        appUrl: env.NEXT_PUBLIC_APP_URL,
      });
      return { source: 'byok', provider, model: sdk.chat(modelId), modelId };
    }
  }
}

function buildPlatformAi(): ActiveAi {
  const modelId =
    process.env.OPENROUTER_MODEL?.trim() || 'deepseek/deepseek-v4-flash';
  const sdk = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY!,
    baseURL: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    appName: 'AutoMate',
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  return {
    source: 'platform',
    provider: 'openrouter',
    model: sdk.chat(modelId),
    modelId,
  };
}
