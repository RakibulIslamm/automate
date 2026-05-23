import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Slack OAuth v2 — issues a bot token (`xoxb-...`) plus workspace info.
 *
 * Arctic ships a `Slack` provider, but it points at the OpenID Connect
 * endpoint (`/openid/connect/authorize`), which is meant for "Sign in with
 * Slack". For bot scopes like `chat:write` you need the v2 endpoint with a
 * different response shape — so we talk to Slack directly here.
 */

const AUTHORIZATION_ENDPOINT = 'https://slack.com/oauth/v2/authorize';
const TOKEN_ENDPOINT = 'https://slack.com/api/oauth.v2.access';
const REVOKE_ENDPOINT = 'https://slack.com/api/auth.revoke';

export const SLACK_BOT_SCOPES = [
  'chat:write',
  'channels:read',
  'groups:read',
  'users:read',
] as const;

export type SlackBotScope = (typeof SLACK_BOT_SCOPES)[number];

/**
 * Slack refuses bot scopes for any redirect URI that isn't HTTPS — even
 * `http://localhost`. For local dev you need a public HTTPS tunnel (ngrok,
 * cloudflared, etc.). Set `SLACK_REDIRECT_URI` to that tunnel's callback
 * URL; we fall back to `NEXT_PUBLIC_APP_URL` for production.
 */
function getRedirectURI(): string {
  if (env.SLACK_REDIRECT_URI) return env.SLACK_REDIRECT_URI;
  const base = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return `${base}/api/oauth/slack/callback`;
}

function s256Challenge(codeVerifier: string): string {
  return createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Slack requires PKCE for any redirect URI it considers "non-web" — which
 * includes `http://localhost:*` in development. The connect route passes a
 * fresh `codeVerifier` (stashed in the state cookie), and we send the
 * `S256` challenge here; the token exchange echoes the verifier back.
 */
export function createSlackAuthorizationUrl(state: string, codeVerifier: string): URL {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  url.searchParams.set('redirect_uri', getRedirectURI());
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SLACK_BOT_SCOPES.join(','));
  url.searchParams.set('code_challenge', s256Challenge(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  // `user_scope` left empty — we only want a bot token, not user identity.
  return url;
}

/**
 * Successful Slack v2 token response. The bot token is the primary credential
 * (`access_token`, prefixed `xoxb-`); workspace info lives in `team`.
 */
export interface SlackTokenResponse {
  ok: true;
  app_id: string;
  authed_user: { id: string };
  scope: string;
  token_type: 'bot';
  access_token: string;
  bot_user_id: string;
  team: { id: string; name: string };
  enterprise: { id: string; name: string } | null;
  is_enterprise_install: boolean;
}

interface SlackErrorResponse {
  ok: false;
  error: string;
}

export class SlackOAuthError extends Error {
  constructor(public readonly slackError: string) {
    super(`Slack returned error: ${slackError}`);
    this.name = 'SlackOAuthError';
  }
}

export async function exchangeSlackCode(
  code: string,
  codeVerifier: string,
): Promise<SlackTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: getRedirectURI(),
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Slack token exchange HTTP ${res.status}`);
  }
  const data = (await res.json()) as SlackTokenResponse | SlackErrorResponse;
  if (!data.ok) throw new SlackOAuthError(data.error);
  return data;
}

/**
 * Best-effort token revocation. Returns true if Slack confirmed revocation,
 * false otherwise — never throws so disconnect can still proceed.
 */
export async function revokeSlackToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}
