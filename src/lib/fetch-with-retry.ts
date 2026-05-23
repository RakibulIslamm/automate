import { ExternalServiceError } from './errors';

/**
 * Drop-in replacement for `fetch` for ALL external API calls (OpenRouter,
 * Stripe, integration providers). Adds:
 *   - Per-request timeout via AbortController (default 15s)
 *   - Exponential backoff with jitter on retryable status codes + network errors
 *   - Wraps terminal failures in ExternalServiceError so route/action wrappers
 *     can surface a clean message to the client.
 *
 * 4xx responses (other than 408/429) are returned as-is — they're caller bugs,
 * not transient failures, and the caller is expected to handle them.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface FetchWithRetryOptions extends RequestInit {
  serviceName: string;
  timeoutMs?: number;
  retries?: number;
}

export async function fetchWithRetry(
  input: string | URL | Request,
  options: FetchWithRetryOptions,
): Promise<Response> {
  const {
    serviceName,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    signal: externalSignal,
    ...init
  } = options;

  let attempt = 0;
  let lastError: unknown;
  let lastResponse: Response | undefined;

  while (attempt <= retries) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);

      if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
        lastResponse = res;
        await sleep(backoffMs(attempt, res.headers.get('retry-after')));
        attempt += 1;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);

      // Caller-initiated abort — propagate without retry
      if (externalSignal?.aborted) throw err;

      lastError = err;
      if (attempt < retries) {
        await sleep(backoffMs(attempt, null));
        attempt += 1;
        continue;
      }
    }
  }

  if (lastResponse) {
    throw new ExternalServiceError(
      serviceName,
      `${serviceName} returned status ${lastResponse.status} after ${retries + 1} attempts.`,
      lastResponse,
    );
  }

  const message = lastError instanceof Error ? lastError.message : 'Network error';
  throw new ExternalServiceError(serviceName, `${serviceName} unreachable: ${message}`, lastError);
}

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const asSeconds = Number(retryAfterHeader);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return Math.min(asSeconds * 1000, 30_000);
    }
  }
  const base = Math.min(500 * 2 ** attempt, 8000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
