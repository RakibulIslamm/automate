import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { IntegrationProvider } from '@/lib/db/models/integration';

/**
 * Short-lived HttpOnly cookies that carry OAuth `state` + PKCE `codeVerifier`
 * between the connect redirect and the callback. Cookies are namespaced per
 * provider so two flows can be in progress without colliding.
 */

const TEN_MINUTES = 60 * 10;

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

function cookieName(provider: IntegrationProvider): string {
  return `oauth_state_${provider}`;
}

export interface OAuthStatePayload {
  state: string;
  codeVerifier: string;
}

export async function setStateCookie(
  provider: IntegrationProvider,
  payload: OAuthStatePayload,
): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(provider), JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TEN_MINUTES,
  });
}

export async function getAndClearStateCookie(
  provider: IntegrationProvider,
): Promise<OAuthStatePayload | null> {
  const jar = await cookies();
  const name = cookieName(provider);
  const raw = jar.get(name)?.value;
  jar.delete(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthStatePayload>;
    if (typeof parsed.state !== 'string' || typeof parsed.codeVerifier !== 'string') {
      return null;
    }
    return { state: parsed.state, codeVerifier: parsed.codeVerifier };
  } catch {
    return null;
  }
}
