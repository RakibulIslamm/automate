import 'server-only';
import { google, type Auth } from 'googleapis';
import { getValidGoogleTokens } from '@/lib/oauth/refresh';
import { env } from '@/lib/env';

/**
 * Build a googleapis OAuth2 client primed with a freshly-refreshed access
 * token. All Google adapters (Gmail, Drive, Calendar) funnel through here so
 * token refresh is centralized.
 */
export async function getGoogleAuth(integrationId: string): Promise<Auth.OAuth2Client> {
  const { accessToken } = await getValidGoogleTokens(integrationId);
  const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}
