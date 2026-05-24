/**
 * Template interpolation for workflow steps.
 *
 * Templates use `{{path.to.value}}` syntax. Paths are dotted with optional
 * `[index]` segments — e.g. `{{trigger.email.from.name}}` or
 * `{{step_1.attachments[0].id}}`. Resolution is lodash-`get`-like.
 *
 * Missing paths render as the literal string `""` inside templates and as
 * `undefined` from `getByPath` — keep this in mind when an empty subject
 * is surprising (often it means the upstream step didn't populate the
 * expected field).
 */

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Resolve a dotted path with optional `[index]` segments against a
 * context object. Returns `undefined` for any unreachable segment.
 *
 * Examples:
 *   getByPath({ a: { b: 1 } }, 'a.b')        // 1
 *   getByPath({ xs: [10, 20] }, 'xs[1]')     // 20
 *   getByPath({ xs: [10] }, 'xs.length')     // 1
 *   getByPath({}, 'nope.gone')               // undefined
 */
export function getByPath(source: unknown, path: string): unknown {
  if (path === '' || source == null) return undefined;

  // Split on `.` but also explode `foo[2]` → `foo`, `2`.
  const segments = path
    .replace(/\[(\w+)\]/g, '.$1')
    .replace(/^\./, '')
    .split('.')
    .filter(Boolean);

  let cursor: unknown = source;
  for (const segment of segments) {
    if (cursor == null) return undefined;
    if (typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * Replace every `{{path}}` occurrence in `template` with the resolved
 * value from `context`. Non-string resolved values are JSON-stringified
 * (objects/arrays) or coerced to string (numbers, booleans). Missing
 * paths produce an empty string so workflows degrade gracefully instead
 * of leaking `{{trigger.foo}}` into outgoing emails.
 */
export function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(TEMPLATE_RE, (_match, rawPath: string) => {
    const value = getByPath(context, rawPath.trim());
    return stringify(value);
  });
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Recursively interpolate template references inside any value:
 *  - strings are passed through `interpolate`
 *  - arrays/objects are mapped over
 *  - everything else is returned as-is
 *
 * Used to render step configs like `notion.create_page`'s `propertiesTemplate`
 * where templates can appear at arbitrary depth.
 */
export function interpolateValue<T>(value: T, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    // Optimization: a string consisting of a single `{{path}}` returns the
    // raw resolved value (preserving type) instead of stringifying. This is
    // important for numeric/boolean refs in expressions and config fields.
    //
    // EXCEPTION: if the path doesn't resolve, fall back to empty string so
    // the result matches `interpolate`'s missing-path behavior. Without
    // this, an unresolved ref inside `notion.create_page`'s nested property
    // shapes leaks `undefined` through to Notion's SDK, which rejects it
    // with a confusing "should be defined" error.
    const sole = matchSoleTemplate(value);
    if (sole !== null) {
      const resolved = getByPath(context, sole);
      // Treat null AND undefined as "missing" — matches `interpolate`'s
      // behavior for multi-token templates. Without this, Gmail headers
      // that come back as `null` (no Subject line, etc.) leak through to
      // Notion's SDK, which strips nulls and then rejects the resulting
      // undefined property with "should be defined" errors.
      return resolved == null ? '' : resolved;
    }
    return interpolate(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, context));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateValue(v, context);
    }
    return out;
  }
  return value;
}

function matchSoleTemplate(input: string): string | null {
  const trimmed = input.trim();
  const m = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed);
  if (!m) return null;
  return m[1] ?? null;
}

/* ───────────────────── re-exports for expression eval ──────────────────── */

export { evaluateExpression, type ExpressionResult } from './expression';
