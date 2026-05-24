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
  const args = buildPostArgs({ channel, text, blocks }, client);

  try {
    const res = await wrap(client.chat.postMessage(args), 'chat.postMessage');
    return { ok: res.ok === true, ts: res.ts, channel: res.channel };
  } catch (err) {
    // not_in_channel: the bot exists in the workspace but isn't a member
    // of this channel. For public channels we can self-join and retry;
    // private channels need a human to `/invite @AutoMate` first.
    if (!isSlackErrorCode(err, 'not_in_channel')) throw err;

    const joined = await tryJoinChannel(client, channel);
    if (!joined.ok) {
      const message =
        joined.reason === 'private'
          ? 'The AutoMate bot is not in this channel. In Slack, run /invite @AutoMate inside the channel and try again.'
          : joined.reason === 'missing_scope'
            ? 'The AutoMate Slack app needs the channels:join permission. Reconnect Slack from the Integrations page to grant it.'
            : `Slack chat.postMessage failed: ${joined.reason}`;
      throw new ExternalServiceError('Slack', message, err);
    }

    const retryRes = await wrap(client.chat.postMessage(args), 'chat.postMessage');
    return { ok: retryRes.ok === true, ts: retryRes.ts, channel: retryRes.channel };
  }
}

/** Slack's `MessageContents` is a discriminated union — either `text` or
 * `blocks` is the primary. If blocks were supplied we send them and use
 * `text` as a fallback string (shown in notifications + screen readers). */
function buildPostArgs(
  { channel, text, blocks }: PostMessageInput,
  client: WebClient,
): Parameters<typeof client.chat.postMessage>[0] {
  if (blocks) {
    return {
      channel,
      text,
      blocks: blocks as Parameters<typeof client.chat.postMessage>[0] extends { blocks: infer B }
        ? B
        : never,
    } as Parameters<typeof client.chat.postMessage>[0];
  }
  return { channel, text } as Parameters<typeof client.chat.postMessage>[0];
}

function isSlackErrorCode(err: unknown, code: string): boolean {
  if (err instanceof ExternalServiceError) {
    return err.message.includes(code);
  }
  return false;
}

/**
 * Try to add the bot to a channel so it can post there. Returns `{ ok: true }`
 * if it's now a member, otherwise `{ ok: false, reason }` with a stable
 * reason the caller can surface.
 *
 * Slack's `conversations.join` only works for public channels — private
 * channels return `method_not_supported_for_channel_type` and require an
 * existing member to invite the bot.
 */
async function tryJoinChannel(
  client: WebClient,
  channel: string,
): Promise<{ ok: true } | { ok: false; reason: 'private' | string }> {
  try {
    await client.conversations.join({ channel });
    return { ok: true };
  } catch (err) {
    const slackErr = err as { data?: { error?: string }; message?: string };
    const code = slackErr.data?.error ?? '';
    if (
      code === 'method_not_supported_for_channel_type' ||
      code === 'channel_not_found' ||
      code === 'is_archived'
    ) {
      return { ok: false, reason: 'private' };
    }
    return { ok: false, reason: code || slackErr.message || 'join failed' };
  }
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
