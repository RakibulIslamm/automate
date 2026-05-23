import 'server-only';
import { Client, isNotionClientError } from '@notionhq/client';
import type {
  AppendBlockChildrenParameters,
  AppendBlockChildrenResponse,
  CreatePageParameters,
  CreatePageResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
  SearchResponse,
} from '@notionhq/client';
import { ExternalServiceError } from '@/lib/errors';
import { getValidNotionTokens } from '@/lib/oauth/refresh';

/**
 * Build a Notion Client for the given integration. Notion access tokens
 * don't expire, but `getValidNotionTokens` still gives us a single place
 * to bump `lastUsedAt` and flip status on tampered ciphertext.
 */
export async function getNotionClient(integrationId: string): Promise<Client> {
  const { accessToken } = await getValidNotionTokens(integrationId);
  return new Client({ auth: accessToken });
}

function wrap<T>(promise: Promise<T>, op: string): Promise<T> {
  return promise.catch((err: unknown) => {
    const message = isNotionClientError(err)
      ? `Notion ${op} failed: ${err.message}`
      : err instanceof Error
        ? err.message
        : `Notion request "${op}" failed.`;
    throw new ExternalServiceError('Notion', message, err);
  });
}

export interface NotionDatabaseHit {
  id: string;
  title: string;
  url: string | null;
}

/**
 * Lists Notion "data sources" visible to the bot — the v5 SDK's replacement
 * for what older SDKs called "databases". Search results still include the
 * fields we care about (id, title, url).
 */
export async function listDatabases(integrationId: string): Promise<NotionDatabaseHit[]> {
  const client = await getNotionClient(integrationId);
  const res = (await wrap(
    client.search({
      filter: { property: 'object', value: 'data_source' },
      page_size: 50,
    }),
    'search',
  )) as SearchResponse;

  return res.results
    .map((item): NotionDatabaseHit | null => {
      if (item.object !== 'data_source') return null;
      const ds = item as Extract<SearchResponse['results'][number], { object: 'data_source' }>;
      const title = 'title' in ds && Array.isArray(ds.title) && ds.title[0]?.plain_text
        ? ds.title[0].plain_text
        : 'Untitled';
      const url = 'url' in ds && typeof ds.url === 'string' ? ds.url : null;
      return { id: ds.id, title, url };
    })
    .filter((x): x is NotionDatabaseHit => x !== null);
}

export async function queryDatabase(
  integrationId: string,
  databaseId: string,
  filter?: QueryDataSourceParameters['filter'],
): Promise<QueryDataSourceResponse> {
  const client = await getNotionClient(integrationId);
  return wrap(
    client.dataSources.query({ data_source_id: databaseId, filter }),
    'dataSources.query',
  );
}

export type CreatePageInput = CreatePageParameters;

export async function createPage(
  integrationId: string,
  input: CreatePageInput,
): Promise<CreatePageResponse> {
  const client = await getNotionClient(integrationId);
  return wrap(client.pages.create(input), 'pages.create');
}

export async function appendBlocks(
  integrationId: string,
  blockId: string,
  children: AppendBlockChildrenParameters['children'],
): Promise<AppendBlockChildrenResponse> {
  const client = await getNotionClient(integrationId);
  return wrap(client.blocks.children.append({ block_id: blockId, children }), 'blocks.children.append');
}

export interface NotionMe {
  id: string;
  name: string;
  type: string;
  workspace_name: string | null;
}

export async function getMe(integrationId: string): Promise<NotionMe> {
  const client = await getNotionClient(integrationId);
  const res = await wrap(client.users.me({}), 'users.me');
  const bot = res as typeof res & { bot?: { workspace_name?: string | null } };
  return {
    id: res.id,
    name: res.name ?? '',
    type: res.type ?? '',
    workspace_name: bot.bot?.workspace_name ?? null,
  };
}
