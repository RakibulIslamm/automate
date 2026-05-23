import 'server-only';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '@/lib/env';

/**
 * OpenRouter client wired to AutoMate's API key. We use OpenRouter (rather
 * than Anthropic directly) so the user can swap models without code changes
 * — same SDK call, different model id.
 *
 * Default model is Claude Sonnet 4.6 via `anthropic/claude-sonnet-4.6`.
 * Override per-request by passing a different id to `model()`.
 */

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || 'deepseek/deepseek-v4-flash';

let cached: ReturnType<typeof createOpenRouter> | null = null;

function getProvider(): ReturnType<typeof createOpenRouter> {
  if (cached) return cached;
  // Real OpenRouter keys are `sk-or-v1-<long-hex>` and run ~73 chars.
  // Fail fast (with `statusCode: 401` so the caller maps it to the same
  // friendly "AI unavailable" toast) and dump the actionable details to
  // the server log only — never to the client.
  const key = env.OPENROUTER_API_KEY;
  if (!key || key.length < 30 || !key.startsWith('sk-or-')) {
    // eslint-disable-next-line no-console
    console.error(
      '[openrouter] OPENROUTER_API_KEY is missing or malformed.\n' +
        '  Get one from https://openrouter.ai/keys and set it in .env.local,\n' +
        '  then restart the dev server.',
    );
    throw Object.assign(new Error('openrouter_api_key_invalid'), { statusCode: 401 });
  }
  cached = createOpenRouter({
    apiKey: key,
    baseURL: env.OPENROUTER_BASE_URL,
    appName: 'AutoMate',
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  return cached;
}

/**
 * Returns a Claude Sonnet model instance ready for `generateText` /
 * `generateObject` / `streamText` from the Vercel AI SDK. Pass a custom
 * model id (e.g. `'anthropic/claude-opus-4'`) to override the default.
 */
export function claude(modelId?: string) {
  return getProvider().chat(modelId ?? DEFAULT_MODEL);
}

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;
