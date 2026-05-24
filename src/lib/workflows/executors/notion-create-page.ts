import 'server-only';
import {
  createPage,
  getDatabasePropertyNames,
  type CreatePageInput,
} from '@/lib/integrations/notion';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveValue, startResult } from './_shared';

export const executeNotionCreatePage: Executor<StepOfType<'notion.create_page'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    // Interpolate every leaf string in the property template so `{{…}}`
    // refs inside nested Notion property shapes resolve correctly.
    const allProperties = resolveValue(step.config.propertiesTemplate, ctx) as Record<
      string,
      unknown
    >;

    // Pre-flight against the actual database schema. Notion rejects the
    // whole create request if it sees an unknown property name — so we
    // look up the schema, drop unknowns, and record what we dropped so
    // the user can see it in the run output. This is the same trade-off
    // Zapier makes when a mapping references a stale column.
    const knownNames = await getDatabasePropertyNames(
      step.config.integrationId,
      step.config.databaseId,
    );
    const properties: Record<string, unknown> = {};
    const droppedProperties: Array<{ name: string; reason: string }> = [];
    for (const [name, value] of Object.entries(allProperties)) {
      const type = knownNames.get(name);
      if (!type) {
        droppedProperties.push({
          name,
          reason: `Database has no "${name}" column.`,
        });
        continue;
      }
      const coerced = coerceToNotionProperty(value, type);
      if (coerced == null) {
        droppedProperties.push({
          name,
          reason: `Column type "${type}" is read-only or unsupported.`,
        });
        continue;
      }
      properties[name] = coerced;
    }

    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      databaseId: step.config.databaseId,
      properties,
      ...(droppedProperties.length > 0 ? { droppedProperties } : {}),
    };

    // Notion v5 SDK splits "database" and "data_source" — the DSL field is
    // still called `databaseId` for user familiarity, and the SDK accepts
    // it under `parent.data_source_id` for data-source-scoped pages.
    const input: CreatePageInput = {
      parent: { data_source_id: step.config.databaseId },
      properties: properties as CreatePageInput['properties'],
    };

    const page = await createPage(step.config.integrationId, input);
    const url = 'url' in page && typeof page.url === 'string' ? page.url : null;
    result.output = {
      pageId: page.id,
      url,
      ...(droppedProperties.length > 0
        ? {
            warnings: droppedProperties.map(
              (d) => `Skipped property "${d.name}": ${d.reason}`,
            ),
          }
        : {}),
    };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};

/**
 * Reshape whatever the AI/user emitted into the exact shape Notion's API
 * wants for a given column type. The AI tends to default to `rich_text`
 * shape regardless of the actual column type — that triggers Notion's
 * "expected to be email/url/number" errors. We extract the underlying
 * text content and rebuild the right wrapper.
 *
 * Returns `null` for property types we can't write (created_time,
 * formula, rollup, etc.) — the caller treats null as "drop with warning".
 */
function coerceToNotionProperty(value: unknown, type: string): unknown {
  const content = extractStringContent(value);

  switch (type) {
    case 'title':
      return { title: [{ type: 'text', text: { content } }] };
    case 'rich_text':
      return { rich_text: [{ type: 'text', text: { content } }] };
    case 'email':
      return { email: extractEmailAddress(content) };
    case 'url':
      return { url: content || null };
    case 'phone_number':
      return { phone_number: content || null };
    case 'number': {
      const n = Number(content);
      return { number: Number.isFinite(n) ? n : null };
    }
    case 'checkbox': {
      const truthy = ['true', 'yes', '1', 'on', 'checked'].includes(content.toLowerCase().trim());
      return { checkbox: truthy };
    }
    case 'date':
      // Best-effort: pass through ISO-ish strings. Notion validates.
      return content ? { date: { start: content } } : { date: null };
    case 'select':
      return content ? { select: { name: content } } : { select: null };
    case 'status':
      return content ? { status: { name: content } } : { status: null };
    case 'multi_select':
      return {
        multi_select: content
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      };
    case 'people':
      // Without a directory lookup we can't resolve names → ids. Drop.
      return null;
    case 'relation':
      // Same — relation values need page ids we don't have here.
      return null;
    case 'files':
      // No way to upload files inline; would need a URL. Drop unless we
      // have an http(s) URL.
      if (/^https?:\/\//i.test(content)) {
        return { files: [{ name: 'attachment', external: { url: content } }] };
      }
      return null;
    case 'created_time':
    case 'last_edited_time':
    case 'created_by':
    case 'last_edited_by':
    case 'formula':
    case 'rollup':
    case 'unique_id':
      // Read-only — Notion will reject writes.
      return null;
    default:
      // Unknown type — pass through the original value and let Notion judge.
      return value;
  }
}

/**
 * Walk an arbitrary shape and pull out the most likely string content.
 * Handles the common Notion-property shapes the AI emits — rich_text
 * arrays, title arrays, plain strings, `{ text: { content } }`, etc.
 */
function extractStringContent(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(extractStringContent).filter(Boolean).join(' ');
  }
  if (typeof value !== 'object') return '';

  const obj = value as Record<string, unknown>;

  // Notion-shaped wrappers we might receive: { title: [...] }, { rich_text: [...] }
  for (const key of ['title', 'rich_text', 'multi_select']) {
    if (Array.isArray(obj[key])) return extractStringContent(obj[key]);
  }

  // Leaf rich_text item: { text: { content: "..." } } or { plain_text: "..." }
  if (typeof obj.plain_text === 'string') return obj.plain_text;
  if (obj.text && typeof obj.text === 'object') {
    const t = obj.text as { content?: unknown };
    if (typeof t.content === 'string') return t.content;
  }

  // Single-key primitives: { content }, { name }, { email }, { url }, { number }
  if (typeof obj.content === 'string') return obj.content;
  if (typeof obj.name === 'string') return obj.name;
  if (typeof obj.email === 'string') return obj.email;
  if (typeof obj.url === 'string') return obj.url;
  if (typeof obj.phone_number === 'string') return obj.phone_number;
  if (typeof obj.number === 'number') return String(obj.number);

  return '';
}

/**
 * Pull a bare email address out of a string like `Intellarch <a@b.com>`
 * or `"a@b.com"`. Returns the original string if no email pattern is
 * found — Notion will then surface its own validation error.
 */
function extractEmailAddress(input: string): string {
  if (!input) return input;
  const angle = input.match(/<([^>\s]+@[^>\s]+)>/);
  if (angle?.[1]) return angle[1];
  const bare = input.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return bare?.[0] ?? input;
}
