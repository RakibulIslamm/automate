import 'server-only';
import { WebClient, ErrorCode, type WebAPICallResult } from '@slack/web-api';
import { ExternalServiceError } from '@/lib/errors';
import { getValidSlackTokens } from '@/lib/oauth/refresh';

/**
 * Build a Slack WebClient primed with the integration's bot token.
 * Centralized so every adapter call goes through `getValidSlackTokens`,
 * which bumps `lastUsedAt` on every read.
 */
export async function getSlackClient(integrationId: string): Promise<WebClient> {
  const { accessToken } = await getValidSlackTokens(integrationId);
  return new WebClient(accessToken);
}

function wrap<T>(promise: Promise<T>, op: string): Promise<T> {
  return promise.catch((err: unknown) => {
    const slackErr = err as { code?: string; data?: { error?: string }; message?: string };
    const message =
      slackErr.code === ErrorCode.PlatformError && slackErr.data?.error
        ? `Slack ${op} failed: ${slackErr.data.error}`
        : slackErr.message ?? `Slack request "${op}" failed.`;
    throw new ExternalServiceError('Slack', message, err);
  });
}

export interface SlackAuthInfo {
  ok: boolean;
  team: string;
  teamId: string;
  user: string;
  userId: string;
}

export async function authTest(integrationId: string): Promise<SlackAuthInfo> {
  const client = await getSlackClient(integrationId);
  const res = (await wrap(client.auth.test(), 'auth.test')) as WebAPICallResult & {
    team?: string;
    team_id?: string;
    user?: string;
    user_id?: string;
  };
  return {
    ok: res.ok === true,
    team: res.team ?? '',
    teamId: res.team_id ?? '',
    user: res.user ?? '',
    userId: res.user_id ?? '',
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
}

export async function listChannels(integrationId: string): Promise<SlackChannel[]> {
  const client = await getSlackClient(integrationId);
  const res = await wrap(
    client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
    }),
    'conversations.list',
  );
  const channels = (res.channels ?? []) as Array<{
    id?: string;
    name?: string;
    is_private?: boolean;
    is_archived?: boolean;
  }>;
  return channels
    .filter((c): c is { id: string; name: string } & typeof c => !!c.id && !!c.name)
    .map((c) => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private ?? false,
      is_archived: c.is_archived ?? false,
    }));
}

export interface PostMessageInput {
  channel: string;
  text: string;
  blocks?: unknown[];
}

export async function postMessage(
  integrationId: string,
  { channel, text, blocks }: PostMessageInput,
): Promise<{ ok: boolean; ts: string | undefined; channel: string | undefined }> {
  const client = await getSlackClient(integrationId);
  // Slack's `MessageContents` is a discriminated union — either `text` or
  // `blocks` is the primary. If blocks were supplied we send them and use
  // `text` as a fallback string (shown in notifications + screen readers).
  const args = blocks
    ? ({
        channel,
        text,
        blocks: blocks as Parameters<typeof client.chat.postMessage>[0] extends { blocks: infer B }
          ? B
          : never,
      } as Parameters<typeof client.chat.postMessage>[0])
    : ({ channel, text } as Parameters<typeof client.chat.postMessage>[0]);
  const res = await wrap(client.chat.postMessage(args), 'chat.postMessage');
  return { ok: res.ok === true, ts: res.ts, channel: res.channel };
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email: string | null;
}

export async function getUserInfo(integrationId: string, userId: string): Promise<SlackUser> {
  const client = await getSlackClient(integrationId);
  const res = await wrap(client.users.info({ user: userId }), 'users.info');
  const user = res.user as
    | {
        id?: string;
        name?: string;
        real_name?: string;
        profile?: { email?: string };
      }
    | undefined;
  return {
    id: user?.id ?? userId,
    name: user?.name ?? '',
    realName: user?.real_name ?? '',
    email: user?.profile?.email ?? null,
  };
}
