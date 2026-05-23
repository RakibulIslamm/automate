/**
 * Runs once at server startup (Node runtime only). We use it to force env
 * validation early — if any required env var is missing or malformed, the app
 * fails to boot with a clear error rather than crashing later on a request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env');
  }
}
