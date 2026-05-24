import 'server-only';
import { redactSecrets } from './sanitize';
import type { ByokAiProvider } from '@/lib/db/models';

/**
 * Per-provider config: where to send the test request, how to authenticate,
 * how to recognise success / invalid-key / rate-limit. We use raw `fetch`
 * for tests so we don't need a per-provider SDK just to verify a key.
 *
 * Each test call uses the **cheapest no-op endpoint** the provider offers
 * (typically `GET /models`) so a curious user testing connection costs
 * essentially nothing.
 */

export type TestStatus = 'active' | 'invalid' | 'rate_limited';

export interface TestResult {
  status: TestStatus;
  message: string;
}

interface ProviderConfig {
  /** OpenAI-compatible base URL (used for both test and AI calls). */
  baseUrl: string;
  /** Endpoint to hit for the "test connection" call. Free / near-free. */
  testPath: string;
  /** Format of the Authorization header for this provider. */
  authHeader: (key: string) => Record<string, string>;
  /** Expected key prefix(es) — used as a quick client-side sanity check. */
  keyPrefixes: readonly string[];
}

const PROVIDERS: Record<ByokAiProvider, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    testPath: '/models',
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
    keyPrefixes: ['sk-'],
  },
  anthropic: {
    // Anthropic doesn't expose a free GET endpoint we can use as a probe,
    // so we send a 1-token message (~$0.0000003). Min-cost honest test.
    baseUrl: 'https://api.anthropic.com/v1',
    testPath: '/messages',
    authHeader: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
    keyPrefixes: ['sk-ant-'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    testPath: '/auth/key',
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
    keyPrefixes: ['sk-or-'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    testPath: '/models',
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
    keyPrefixes: ['sk-'],
  },
};

export function getProviderConfig(provider: ByokAiProvider): ProviderConfig {
  return PROVIDERS[provider];
}

/**
 * Quick client-side sanity check on key shape — catches the most common
 * "I pasted the wrong thing" case before we even hit the network.
 */
export function looksLikeValidKey(provider: ByokAiProvider, key: string): boolean {
  const cfg = PROVIDERS[provider];
  if (key.length < 20) return false;
  return cfg.keyPrefixes.some((p) => key.startsWith(p));
}

/**
 * Send a minimal-cost probe to confirm the key works. Resolves to a
 * normalized status — never throws. Network failures map to `invalid`
 * with a generic message; provider-specific errors get their HTTP
 * status mapped to one of our three states.
 */
export async function testAiProviderKey(
  provider: ByokAiProvider,
  apiKey: string,
): Promise<TestResult> {
  const cfg = PROVIDERS[provider];
  try {
    if (provider === 'anthropic') {
      // Anthropic needs a real request body.
      const res = await fetch(`${cfg.baseUrl}${cfg.testPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cfg.authHeader(apiKey) },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ok' }],
        }),
      });
      return interpretStatus(res.status);
    }

    const res = await fetch(`${cfg.baseUrl}${cfg.testPath}`, {
      method: 'GET',
      headers: cfg.authHeader(apiKey),
    });
    return interpretStatus(res.status);
  } catch (err) {
    const msg = redactSecrets(err instanceof Error ? err.message : 'Unknown error');
    return { status: 'invalid', message: `Could not reach provider: ${msg}` };
  }
}

function interpretStatus(status: number): TestResult {
  if (status >= 200 && status < 300) return { status: 'active', message: 'Connected.' };
  if (status === 401 || status === 403) return { status: 'invalid', message: 'Key was rejected.' };
  if (status === 429) return { status: 'rate_limited', message: 'Rate limited — try again later.' };
  return { status: 'invalid', message: `Provider returned ${status}.` };
}
