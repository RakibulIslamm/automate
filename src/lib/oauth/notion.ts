import 'server-only';
import { Notion } from 'arctic';
import { env } from '@/lib/env';

/**
 * Notion OAuth — internal integration on behalf of the user. The token
 * response includes workspace metadata (`workspace_id`, `workspace_name`)
 * and a `bot_id`. Notion access tokens don't expire, so there is no refresh
 * flow; we revoke via a token revocation endpoint on disconnect.
 */

function getRedirectURI(): string {
  const base = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return `${base}/api/oauth/notion/callback`;
}

let cached: Notion | null = null;

export function getNotionOAuthClient(): Notion {
  if (cached) return cached;
  cached = new Notion(env.NOTION_CLIENT_ID, env.NOTION_CLIENT_SECRET, getRedirectURI());
  return cached;
}

export function createNotionAuthorizationUrl(state: string): URL {
  return getNotionOAuthClient().createAuthorizationURL(state);
}

/**
 * Fields Notion attaches to the token response beyond the OAuth 2.0
 * standard. We surface these so the callback can record `providerAccountId`
 * (bot_id) and `displayName` (workspace_name).
 */
export interface NotionTokenExtras {
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner?: { type: string; user?: { id: string; name?: string | null } };
}

export function readNotionExtras(raw: unknown): NotionTokenExtras {
  const data = (raw ?? {}) as Partial<NotionTokenExtras>;
  return {
    bot_id: typeof data.bot_id === 'string' ? data.bot_id : '',
    workspace_id: typeof data.workspace_id === 'string' ? data.workspace_id : '',
    workspace_name: typeof data.workspace_name === 'string' ? data.workspace_name : null,
    workspace_icon: typeof data.workspace_icon === 'string' ? data.workspace_icon : null,
    owner: data.owner,
  };
}

/**
 * Notion supports OAuth token revocation per RFC 7009. Best-effort — never
 * throws, so disconnect proceeds even if Notion's endpoint is unavailable.
 */
export async function revokeNotionToken(accessToken: string): Promise<boolean> {
  try {
    const basic = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString(
      'base64',
    );
    const res = await fetch('https://api.notion.com/v1/oauth/revoke', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: accessToken }),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
