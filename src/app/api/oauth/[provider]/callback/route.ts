import { NextResponse, type NextRequest } from 'next/server';
import { OAuth2RequestError } from 'arctic';
import { NotFoundError } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import {
  GOOGLE_INTEGRATION_SCOPES,
  fetchGoogleProfile,
  getGoogleClient,
} from '@/lib/oauth/google';
import { exchangeSlackCode, SLACK_BOT_SCOPES, SlackOAuthError } from '@/lib/oauth/slack';
import { getNotionOAuthClient, readNotionExtras } from '@/lib/oauth/notion';
import { getAndClearStateCookie } from '@/lib/oauth/state';
import { encryptJSON } from '@/lib/crypto';
import { connectDb } from '@/lib/db/connect';
import { Integration, INTEGRATION_PROVIDERS, type IntegrationProvider } from '@/lib/db/models';
import { PROVIDER_CONFIG } from '@/lib/oauth/providers';
import { logError } from '@/lib/tracking/log-error';
import { trackEvent } from '@/lib/tracking/event';
import type {
  GoogleTokenPayload,
  NotionTokenPayload,
  SlackTokenPayload,
} from '@/lib/oauth/refresh';
import type { UserDoc } from '@/lib/db/models';

function isProvider(v: string): v is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(v);
}

function backTo(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/dashboard/integrations', req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

interface UpsertInput {
  user: UserDoc;
  provider: IntegrationProvider;
  providerAccountId: string;
  displayName: string;
  scopes: string[];
  encryptedTokens: string;
}

async function upsertIntegration(input: UpsertInput): Promise<void> {
  await connectDb();
  await Integration.findOneAndUpdate(
    {
      userId: input.user._id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    },
    {
      $set: {
        encryptedTokens: input.encryptedTokens,
        scopes: input.scopes,
        status: 'active',
        displayName: input.displayName,
        connectedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function handleGoogleCallback(
  req: NextRequest,
  user: UserDoc,
  code: string,
  codeVerifier: string,
): Promise<NextResponse> {
  const tokens = await getGoogleClient().validateAuthorizationCode(code, codeVerifier);
  const accessToken = tokens.accessToken();
  const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : '';
  const expiresAt = tokens.accessTokenExpiresAt().getTime();
  const grantedScopes = tokens.hasScopes()
    ? tokens.scopes()
    : Array.from(GOOGLE_INTEGRATION_SCOPES);

  if (!refreshToken) {
    return backTo(req, {
      error:
        'Google didn\'t return a refresh token. Disconnect and re-connect with "Select Google Account".',
    });
  }

  const profile = await fetchGoogleProfile(accessToken);
  const payload: GoogleTokenPayload = {
    accessToken,
    refreshToken,
    expiresAt,
    scopes: grantedScopes,
  };

  await upsertIntegration({
    user,
    provider: 'google',
    providerAccountId: profile.sub,
    displayName: profile.email,
    scopes: grantedScopes,
    encryptedTokens: encryptJSON(payload),
  });

  await trackEvent('integration.connected', {
    userId: String(user._id),
    properties: { provider: 'google', email: profile.email },
  });

  return backTo(req, { success: 'google' });
}

async function handleSlackCallback(
  req: NextRequest,
  user: UserDoc,
  code: string,
  codeVerifier: string,
): Promise<NextResponse> {
  const tokens = await exchangeSlackCode(code, codeVerifier);
  const grantedScopes = tokens.scope ? tokens.scope.split(',').map((s) => s.trim()) : Array.from(SLACK_BOT_SCOPES);

  const payload: SlackTokenPayload = {
    accessToken: tokens.access_token,
    scopes: grantedScopes,
    botUserId: tokens.bot_user_id,
    teamId: tokens.team.id,
    teamName: tokens.team.name,
  };

  await upsertIntegration({
    user,
    provider: 'slack',
    providerAccountId: tokens.team.id,
    displayName: tokens.team.name,
    scopes: grantedScopes,
    encryptedTokens: encryptJSON(payload),
  });

  await trackEvent('integration.connected', {
    userId: String(user._id),
    properties: { provider: 'slack', team: tokens.team.name },
  });

  return backTo(req, { success: 'slack' });
}

async function handleNotionCallback(
  req: NextRequest,
  user: UserDoc,
  code: string,
): Promise<NextResponse> {
  const tokens = await getNotionOAuthClient().validateAuthorizationCode(code);
  const extras = readNotionExtras(tokens.data);
  const accessToken = tokens.accessToken();

  if (!extras.bot_id || !extras.workspace_id) {
    return backTo(req, {
      error: 'Notion didn\'t return workspace info. Please try connecting again.',
    });
  }

  const payload: NotionTokenPayload = {
    accessToken,
    botId: extras.bot_id,
    workspaceId: extras.workspace_id,
    workspaceName: extras.workspace_name,
    workspaceIcon: extras.workspace_icon,
  };

  const displayName = extras.workspace_name ?? `Workspace ${extras.workspace_id.slice(0, 8)}`;

  await upsertIntegration({
    user,
    provider: 'notion',
    // One Integration row per (user, workspace) — bot_id changes on
    // re-install while workspace_id stays put, so workspace_id is the
    // stable identifier for de-duplication.
    providerAccountId: extras.workspace_id,
    displayName,
    scopes: [],
    encryptedTokens: encryptJSON(payload),
  });

  await trackEvent('integration.connected', {
    userId: String(user._id),
    properties: { provider: 'notion', workspace: displayName },
  });

  return backTo(req, { success: 'notion' });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) {
    throw new NotFoundError(`Unknown integration provider: ${provider}`);
  }

  const userDoc = await requireUser().catch(() => null);
  if (!userDoc) {
    const signIn = new URL('/sign-in', req.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', '/dashboard/integrations');
    return NextResponse.redirect(signIn);
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const providerError = req.nextUrl.searchParams.get('error');
  const label = PROVIDER_CONFIG[provider].shortLabel;

  if (providerError) {
    return backTo(req, { error: friendlyConsentError(label, providerError) });
  }
  if (!code || !stateParam) {
    return backTo(req, { error: 'Missing OAuth code or state. Please try connecting again.' });
  }

  const stored = await getAndClearStateCookie(provider);
  if (!stored || stored.state !== stateParam) {
    return backTo(req, { error: 'OAuth state mismatch. Please start the flow over.' });
  }

  try {
    switch (provider) {
      case 'google':
        return await handleGoogleCallback(req, userDoc, code, stored.codeVerifier);
      case 'slack':
        return await handleSlackCallback(req, userDoc, code, stored.codeVerifier);
      case 'notion':
        return await handleNotionCallback(req, userDoc, code);
      default: {
        const _exhaustive: never = provider;
        throw new NotFoundError(`Unsupported integration provider: ${String(_exhaustive)}`);
      }
    }
  } catch (err) {
    await logError(err, {
      source: 'oauth-callback',
      userId: String(userDoc._id),
      extra: { provider },
    });
    if (err instanceof SlackOAuthError) {
      return backTo(req, { error: `Slack rejected the connection: ${err.slackError}` });
    }
    if (err instanceof OAuth2RequestError) {
      return backTo(req, { error: `${label} rejected the connection: ${err.message}` });
    }
    return backTo(req, { error: `Failed to finish connecting ${label}. Please try again.` });
  }
}

function friendlyConsentError(label: string, code: string): string {
  if (code === 'access_denied') return `You declined the ${label} consent screen.`;
  return `${label} returned an error: ${code}`;
}
