import 'server-only';
import { Types } from 'mongoose';
import { OAuth2RequestError } from 'arctic';
import { connectDb } from '@/lib/db/connect';
import { Integration, type IntegrationProvider } from '@/lib/db/models';
import { decryptJSON, encryptJSON } from '@/lib/crypto';
import { getGoogleClient } from './google';
import { IntegrationDisconnectedError, NotFoundError } from '@/lib/errors';
import { logError } from '@/lib/tracking/log-error';

/**
 * Encrypted-token payload shapes. All variants are JSON-serialized then
 * AES-256-GCM encrypted (`encryptJSON`) and stored on
 * `Integration.encryptedTokens`.
 */

export interface GoogleTokenPayload {
  accessToken: string;
  refreshToken: string;
  /** Unix ms timestamp of access-token expiry. */
  expiresAt: number;
  scopes: string[];
}

export interface SlackTokenPayload {
  /** Bot token, prefixed `xoxb-`. */
  accessToken: string;
  scopes: string[];
  botUserId: string;
  teamId: string;
  teamName: string;
}

export interface NotionTokenPayload {
  accessToken: string;
  botId: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
}

export interface ValidTokens {
  accessToken: string;
  scopes: string[];
}

const SKEW_MS = 60 * 1000;

function objectIdFrom(value: string | Types.ObjectId): Types.ObjectId {
  return new Types.ObjectId(String(value));
}

async function markStatus(
  _id: Types.ObjectId,
  status: 'active' | 'expired' | 'error' | 'revoked',
  extra: Record<string, unknown> = {},
): Promise<void> {
  await Integration.updateOne({ _id }, { $set: { status, ...extra } }).catch(() => {});
}

/**
 * Returns a fresh Google access token for the given integration. Reads the
 * encrypted blob, refreshes against Google if expired (or within 60s of
 * expiry), and writes the new tokens back. On refresh failure marks the
 * integration `status: 'expired'` and surfaces `IntegrationDisconnectedError`
 * so callers can prompt the user to reconnect.
 */
export async function getValidGoogleTokens(
  integrationId: string | Types.ObjectId,
): Promise<ValidTokens> {
  await connectDb();
  const _id = objectIdFrom(integrationId);
  const doc = await Integration.findById(_id);
  if (!doc) throw new NotFoundError('Integration not found.');
  if (doc.provider !== 'google') {
    throw new NotFoundError('Integration is not a Google integration.');
  }

  let payload: GoogleTokenPayload;
  try {
    payload = decryptJSON<GoogleTokenPayload>(doc.encryptedTokens);
  } catch (err) {
    await markStatus(_id, 'error');
    await logError(err, { source: 'oauth-refresh.decrypt', extra: { integrationId: String(_id) } });
    throw new IntegrationDisconnectedError(
      'Google',
      'Stored Google credentials are unreadable. Reconnect Google to continue.',
      err,
    );
  }

  const stillFresh = payload.expiresAt - Date.now() > SKEW_MS;
  if (stillFresh && payload.accessToken) {
    await Integration.updateOne({ _id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
    return { accessToken: payload.accessToken, scopes: payload.scopes };
  }

  if (!payload.refreshToken) {
    await markStatus(_id, 'expired');
    throw new IntegrationDisconnectedError('Google');
  }

  try {
    const tokens = await getGoogleClient().refreshAccessToken(payload.refreshToken);
    const next: GoogleTokenPayload = {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : payload.refreshToken,
      expiresAt: tokens.accessTokenExpiresAt().getTime(),
      scopes: tokens.hasScopes() ? tokens.scopes() : payload.scopes,
    };
    await Integration.updateOne(
      { _id },
      {
        $set: {
          encryptedTokens: encryptJSON(next),
          scopes: next.scopes,
          status: 'active',
          lastUsedAt: new Date(),
        },
      },
    );
    return { accessToken: next.accessToken, scopes: next.scopes };
  } catch (err) {
    await markStatus(_id, 'expired');
    await logError(err, { source: 'oauth-refresh.google', extra: { integrationId: String(_id) } });
    if (err instanceof OAuth2RequestError) {
      throw new IntegrationDisconnectedError(
        'Google',
        'Google rejected the refresh token. Please reconnect Google.',
        err,
      );
    }
    throw new IntegrationDisconnectedError('Google', undefined, err);
  }
}

/**
 * Slack bot tokens don't expire and Slack doesn't issue refresh tokens for
 * bot scopes by default. We just decrypt, surface tampering, and bump
 * `lastUsedAt`. Revocation flips status to `revoked` via the disconnect path.
 */
export async function getValidSlackTokens(
  integrationId: string | Types.ObjectId,
): Promise<ValidTokens> {
  await connectDb();
  const _id = objectIdFrom(integrationId);
  const doc = await Integration.findById(_id);
  if (!doc) throw new NotFoundError('Integration not found.');
  if (doc.provider !== 'slack') {
    throw new NotFoundError('Integration is not a Slack integration.');
  }

  let payload: SlackTokenPayload;
  try {
    payload = decryptJSON<SlackTokenPayload>(doc.encryptedTokens);
  } catch (err) {
    await markStatus(_id, 'error');
    await logError(err, { source: 'oauth-refresh.decrypt', extra: { integrationId: String(_id) } });
    throw new IntegrationDisconnectedError(
      'Slack',
      'Stored Slack credentials are unreadable. Reconnect Slack to continue.',
      err,
    );
  }

  await Integration.updateOne({ _id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  return { accessToken: payload.accessToken, scopes: payload.scopes };
}

/**
 * Notion access tokens don't expire (per Notion's docs as of 2026-05).
 * Same shape as Slack — decrypt, tamper-check, bump `lastUsedAt`.
 */
export async function getValidNotionTokens(
  integrationId: string | Types.ObjectId,
): Promise<ValidTokens> {
  await connectDb();
  const _id = objectIdFrom(integrationId);
  const doc = await Integration.findById(_id);
  if (!doc) throw new NotFoundError('Integration not found.');
  if (doc.provider !== 'notion') {
    throw new NotFoundError('Integration is not a Notion integration.');
  }

  let payload: NotionTokenPayload;
  try {
    payload = decryptJSON<NotionTokenPayload>(doc.encryptedTokens);
  } catch (err) {
    await markStatus(_id, 'error');
    await logError(err, { source: 'oauth-refresh.decrypt', extra: { integrationId: String(_id) } });
    throw new IntegrationDisconnectedError(
      'Notion',
      'Stored Notion credentials are unreadable. Reconnect Notion to continue.',
      err,
    );
  }

  await Integration.updateOne({ _id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  return { accessToken: payload.accessToken, scopes: doc.scopes ?? [] };
}

/**
 * Provider-agnostic dispatcher. Routes to the right `getValid*Tokens` based
 * on the Integration row's `provider`. Useful for code paths that work
 * across providers (UI tests, generic workflow steps).
 */
export async function getValidTokens(
  integrationId: string | Types.ObjectId,
): Promise<ValidTokens & { provider: IntegrationProvider }> {
  await connectDb();
  const doc = await Integration.findById(objectIdFrom(integrationId)).select('provider');
  if (!doc) throw new NotFoundError('Integration not found.');
  switch (doc.provider) {
    case 'google': {
      const { accessToken, scopes } = await getValidGoogleTokens(integrationId);
      return { provider: 'google', accessToken, scopes };
    }
    case 'slack': {
      const { accessToken, scopes } = await getValidSlackTokens(integrationId);
      return { provider: 'slack', accessToken, scopes };
    }
    case 'notion': {
      const { accessToken, scopes } = await getValidNotionTokens(integrationId);
      return { provider: 'notion', accessToken, scopes };
    }
    default: {
      const _exhaustive: never = doc.provider;
      throw new NotFoundError(`Unsupported integration provider: ${String(_exhaustive)}`);
    }
  }
}
