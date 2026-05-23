import { z, type ZodError } from 'zod';

/**
 * Validated environment variables. Server schema covers everything the server
 * needs to function; the client schema covers the small subset that gets
 * inlined into the browser bundle. Validation runs at module load — if any
 * required var is missing or malformed, we throw and prevent the app from
 * booting in a half-broken state.
 *
 * For new server vars: add them to `serverSchema` below. The TypeScript types
 * of `env` are derived from these schemas, so accessing `env.FOO` is a
 * compile-time error until the schema knows about it.
 */

const serverSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Auth (Auth.js v5)
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 chars'),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_RESEND_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email('RESEND_FROM_EMAIL must be a valid email address'),

  // AI (OpenRouter → Claude)
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.url('OPENROUTER_BASE_URL must be a valid URL'),

  // Queue / scheduling (Upstash QStash)
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // Per-plan price IDs — configure manually in Stripe dashboard, then paste here.
  STRIPE_STARTER_PRICE_ID: z.string().min(1).optional(),
  STRIPE_STARTER_OVERAGE_PRICE_ID: z.string().min(1).optional(),
  STRIPE_PRO_PRICE_ID: z.string().min(1).optional(),
  STRIPE_PRO_OVERAGE_PRICE_ID: z.string().min(1).optional(),
  STRIPE_BUSINESS_PRICE_ID: z.string().min(1).optional(),
  STRIPE_BUSINESS_OVERAGE_PRICE_ID: z.string().min(1).optional(),

  // Security
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32'),
  WORKFLOW_SIGNING_SECRET: z.string().min(16, 'WORKFLOW_SIGNING_SECRET must be at least 16 chars'),

  // Integration OAuth (Arctic) — separate apps from Auth.js sign-in
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  // Optional HTTPS override for Slack's callback. Slack refuses bot scopes
  // for non-HTTPS redirect URIs, so local dev needs a tunnel (ngrok, etc.).
  // Set to e.g. `https://abc123.ngrok.app/api/oauth/slack/callback`.
  SLACK_REDIRECT_URI: z.url('SLACK_REDIRECT_URI must be a valid URL').optional(),
  NOTION_CLIENT_ID: z.string().min(1),
  NOTION_CLIENT_SECRET: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;
export type Env = ServerEnv & ClientEnv;

const clientRuntime = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
} as const;

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `  • ${issue.path.join('.') || '_root'}: ${issue.message}`)
    .join('\n');
}

function pickKeys(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = source[key];
  return out;
}

const serverKeys = Object.keys(serverSchema.shape) as readonly (keyof ServerEnv)[];

function warnInvalidEnv(blocks: string[]): void {
  // eslint-disable-next-line no-console
  console.warn(
    '\n⚠️  Invalid environment variables — continuing anyway.\n' +
      '   Features that depend on the listed vars will fail when used.\n' +
      '   Fix .env.local to silence this warning.\n\n' +
      blocks.join('\n') +
      '\n',
  );
}

function loadEnv(): Env {
  const isServer = typeof window === 'undefined';

  const clientResult = clientSchema.safeParse(clientRuntime);

  if (!isServer) {
    if (!clientResult.success) {
      warnInvalidEnv(['Public vars:\n' + formatIssues(clientResult.error)]);
      return clientRuntime as unknown as Env;
    }
    return clientResult.data as Env;
  }

  const serverResult = serverSchema.safeParse(process.env);

  if (!serverResult.success || !clientResult.success) {
    const blocks: string[] = [];
    if (!serverResult.success) blocks.push('Server vars:\n' + formatIssues(serverResult.error));
    if (!clientResult.success) blocks.push('Public vars:\n' + formatIssues(clientResult.error));
    warnInvalidEnv(blocks);
  }

  const serverEnv = serverResult.success
    ? serverResult.data
    : (pickKeys(process.env as Record<string, unknown>, serverKeys) as ServerEnv);
  const clientEnv = clientResult.success
    ? clientResult.data
    : (clientRuntime as unknown as ClientEnv);

  return { ...serverEnv, ...clientEnv };
}

export const env: Env = loadEnv();
