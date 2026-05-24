/**
 * Replace any apparent API key inside a string with `[REDACTED]` before it
 * touches a logger or error tracker. Cheap, conservative regexes — false
 * positives are fine (a non-key UUID gets redacted, no harm); false
 * negatives are not (a real key sneaks into Sentry).
 *
 * Use everywhere a BYOK provider error message could end up in a log line.
 */
const PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_\-]{20,}/g,           // OpenAI / Anthropic / generic "sk-..."
  /sk_(?:test|live)_[A-Za-z0-9]{20,}/g, // Stripe secret
  /pk_(?:test|live)_[A-Za-z0-9]{20,}/g, // Stripe publishable
  /whsec_[A-Za-z0-9]{20,}/g,           // Stripe webhook secret
  /Bearer\s+[A-Za-z0-9._\-]{20,}/g,    // bearer tokens
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const re of PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}

/** Build a `last4`-style display string from a raw key. Never store the rest. */
export function last4(key: string): string {
  const tail = key.slice(-4);
  return `…${tail}`;
}
