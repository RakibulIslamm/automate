import { NextResponse, type NextRequest } from 'next/server';
import { generateCodeVerifier } from 'arctic';
import { NotFoundError } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import { createAuthorizationUrl as createGoogleAuthorizationUrl } from '@/lib/oauth/google';
import { createSlackAuthorizationUrl } from '@/lib/oauth/slack';
import { createNotionAuthorizationUrl } from '@/lib/oauth/notion';
import { generateState, setStateCookie } from '@/lib/oauth/state';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '@/lib/db/models/integration';
import { PROVIDER_CONFIG } from '@/lib/oauth/providers';
import { logError } from '@/lib/tracking/log-error';

/**
 * GET /api/oauth/{provider}/connect — kicks off the OAuth dance. Generates
 * opaque state (and a PKCE code verifier for providers that support it),
 * stashes them in an HttpOnly cookie, and 302s the user to the provider's
 * consent screen.
 *
 * Not using `safeRoute` because this is a redirect endpoint — JSON errors
 * would never be seen. On failure we still redirect to the integrations
 * page with `?error=...` so the UI can show a toast.
 */

function isProvider(v: string): v is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(v);
}

function errorRedirect(req: NextRequest, message: string): NextResponse {
  const url = new URL('/dashboard/integrations', req.nextUrl.origin);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

async function buildConsentUrl(provider: IntegrationProvider): Promise<URL> {
  const state = generateState();
  switch (provider) {
    case 'google': {
      const codeVerifier = generateCodeVerifier();
      await setStateCookie('google', { state, codeVerifier });
      return createGoogleAuthorizationUrl(state, codeVerifier);
    }
    case 'slack': {
      // Slack requires PKCE whenever the redirect URI is "non-web" — which
      // includes `http://localhost:*` in development. Generate the verifier
      // here, stash it in the cookie, and send the S256 challenge to Slack.
      const codeVerifier = generateCodeVerifier();
      await setStateCookie('slack', { state, codeVerifier });
      return createSlackAuthorizationUrl(state, codeVerifier);
    }
    case 'notion': {
      await setStateCookie('notion', { state, codeVerifier: '' });
      return createNotionAuthorizationUrl(state);
    }
    default: {
      const _exhaustive: never = provider;
      throw new NotFoundError(`Unsupported integration provider: ${String(_exhaustive)}`);
    }
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;

  if (!isProvider(provider)) {
    throw new NotFoundError(`Unknown integration provider: ${provider}`);
  }

  try {
    await requireUser();
  } catch {
    const signIn = new URL('/sign-in', req.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', `/api/oauth/${provider}/connect`);
    return NextResponse.redirect(signIn);
  }

  try {
    const url = await buildConsentUrl(provider);
    return NextResponse.redirect(url);
  } catch (err) {
    await logError(err, { source: 'oauth-connect', extra: { provider } });
    const label = PROVIDER_CONFIG[provider].shortLabel;
    return errorRedirect(req, `Couldn't start the ${label} connection. Please try again.`);
  }
}
