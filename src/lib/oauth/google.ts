import 'server-only';
import { Google } from 'arctic';
import { env } from '@/lib/env';

/**
 * Google OAuth client for integration token capture (Gmail/Drive/Calendar).
 * Distinct from the Auth.js Google sign-in client — different redirect URI,
 * different scopes, separate credentials. Both must be registered in the
 * same (or different) Google Cloud OAuth consent screen.
 */

export const GOOGLE_INTEGRATION_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar',
] as const;

export type GoogleIntegrationScope = (typeof GOOGLE_INTEGRATION_SCOPES)[number];

function getRedirectURI(): string {
  const base = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return `${base}/api/oauth/google/callback`;
}

let cached: Google | null = null;

export function getGoogleClient(): Google {
  if (cached) return cached;
  cached = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getRedirectURI());
  return cached;
}

/**
 * Build the consent URL. Arctic's `createAuthorizationURL` doesn't set
 * `access_type=offline` or `prompt=consent`, which Google requires to issue
 * a `refresh_token`. We append them after the fact.
 */
export function createAuthorizationUrl(state: string, codeVerifier: string): URL {
  const url = getGoogleClient().createAuthorizationURL(
    state,
    codeVerifier,
    Array.from(GOOGLE_INTEGRATION_SCOPES),
  );
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  return url;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Fetch the signed-in user's Google profile so we can record
 * `providerAccountId` and a friendly `displayName` on the Integration doc.
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  return (await res.json()) as GoogleProfile;
}
