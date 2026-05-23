import jsep from 'jsep';
import { getByPath, interpolate } from './interpolate';

/**
 * Safe expression evaluator for `condition.if` step expressions.
 *
 * Strategy:
 *   1. Substitute `{{path}}` template refs with literal values from the
 *      runtime context BEFORE parsing. Strings become JSON-encoded strings;
 *      numbers/booleans become bare literals. This lets the parser see a
 *      proper JS expression instead of an opaque interpolated soup.
 *   2. Parse the resulting expression with `jsep` (parse-only — no eval).
 *   3. Walk the AST with `evalNode`, which whitelists exactly the operators
 *      we support. `eval`/`Function` are never invoked, so a malicious
 *      expression can't reach into the runtime.
 *
 * Supported features:
 *   - Comparison: `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`
 *   - Logical:    `&&`, `||`, `!`
 *   - Arithmetic: `+`, `-`, `*`, `/`, `%`
 *   - Member access: `a.b`, `a["b"]`, `a[0]`
 *   - Literals (numbers, strings, booleans, null)
 *   - Array literals, ternary `a ? b : c`
 *
 * Examples (assuming context = { count: 10, status: "open" }):
 *   evaluateExpression("{{count}} > 5", ctx).value           // true
 *   evaluateExpression("{{status}} == 'open'", ctx).value    // true
 *   evaluateExpression("{{count}} > 5 && {{count}} < 100")   // true
 *   evaluateExpression("!{{missing}}").value                 // true (missing → null)
 */

export interface ExpressionResult {
  /** Truthy/falsy result of the expression. */
  value: boolean;
  /** Set when parsing or evaluation failed; `value` defaults to false. */
  error?: string;
}

const ALLOWED_BINARY = new Set([
  '+', '-', '*', '/', '%',
  '==', '!=', '===', '!==', '>', '<', '>=', '<=',
  '&&', '||',
]);

const ALLOWED_UNARY = new Set(['!', '-', '+']);

export function evaluateExpression(
  expression: string,
  context: Record<string, unknown>,
): ExpressionResult {
  let parsed: jsep.Expression;
  let prepared: string;
  try {
    prepared = substituteTemplates(expression, context);
  } catch (err) {
    return { value: false, error: humanError(err) };
  }
  try {
    parsed = jsep(prepared);
  } catch (err) {
    return { value: false, error: `Parse error: ${humanError(err)}` };
  }

  try {
    const result = evalNode(parsed, context);
    return { value: Boolean(result) };
  } catch (err) {
    return { value: false, error: humanError(err) };
  }
}

/**
 * Replace `{{path}}` with a JSON-encoded literal of the resolved value so
 * the downstream parser sees a clean JS expression.
 *
 * Resolved values become:
 *   string  → JSON-quoted string ("foo")
 *   number  → bare number
 *   boolean → true / false
 *   null/undefined → null
 *   object/array → JSON literal (`{"a":1}` or `[1,2]`)
 */
function substituteTemplates(input: string, context: Record<string, unknown>): string {
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, rawPath: string) => {
    const value = getByPath(context, rawPath.trim());
    return JSON.stringify(value ?? null);
  });
}

function evalNode(node: jsep.Expression, context: Record<string, unknown>): unknown {
  switch (node.type) {
    case 'Literal':
      return (node as jsep.Literal).value;

    case 'Identifier': {
      // Bare identifiers (e.g. `count` without `{{ }}`) resolve against the
      // runtime context too — handy for AI-generated expressions that
      // forget the curlies.
      const name = (node as jsep.Identifier).name;
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null') return null;
      return context[name];
    }

    case 'ArrayExpression': {
      const arr = (node as jsep.ArrayExpression).elements;
      return arr.map((el) => (el === null ? null : evalNode(el, context)));
    }

    case 'UnaryExpression': {
      const u = node as jsep.UnaryExpression;
      if (!ALLOWED_UNARY.has(u.operator)) {
        throw new Error(`Unary operator '${u.operator}' is not allowed`);
      }
      const arg = evalNode(u.argument, context) as number | boolean;
      switch (u.operator) {
        case '!':
          return !arg;
        case '-':
          return -(Number(arg));
        case '+':
          return +(Number(arg));
        default:
          throw new Error(`Unhandled unary operator '${u.operator}'`);
      }
    }

    // jsep emits `BinaryExpression` for `&&` and `||` (no separate
    // `LogicalExpression` node like ESTree).
    case 'BinaryExpression': {
      const b = node as jsep.BinaryExpression;
      if (!ALLOWED_BINARY.has(b.operator)) {
        throw new Error(`Operator '${b.operator}' is not allowed`);
      }
      // Short-circuit for logical ops.
      if (b.operator === '&&') {
        const left = evalNode(b.left, context);
        return left ? evalNode(b.right, context) : left;
      }
      if (b.operator === '||') {
        const left = evalNode(b.left, context);
        return left ? left : evalNode(b.right, context);
      }
      // Eval both sides as `unknown` and let the JS runtime do its normal
      // coercion. We re-tag through specific numeric/string locals for the
      // ops where TS would otherwise complain about mixed types.
      const lhs: unknown = evalNode(b.left, context);
      const rhs: unknown = evalNode(b.right, context);
      const ln = lhs as number;
      const rn = rhs as number;
      const ls = lhs as string;
      const rs = rhs as string;
      switch (b.operator) {
        case '+':
          // JS `+`: if either side is a string, concatenates; otherwise adds.
          return typeof lhs === 'string' || typeof rhs === 'string' ? ls + rs : ln + rn;
        case '-': return ln - rn;
        case '*': return ln * rn;
        case '/': return ln / rn;
        case '%': return ln % rn;
        case '==': return lhs == rhs; // eslint-disable-line eqeqeq
        case '!=': return lhs != rhs; // eslint-disable-line eqeqeq
        case '===': return lhs === rhs;
        case '!==': return lhs !== rhs;
        case '>': return ln > rn;
        case '<': return ln < rn;
        case '>=': return ln >= rn;
        case '<=': return ln <= rn;
        default:
          throw new Error(`Unhandled binary operator '${b.operator}'`);
      }
    }

    case 'ConditionalExpression': {
      const c = node as jsep.ConditionalExpression;
      return evalNode(c.test, context)
        ? evalNode(c.consequent, context)
        : evalNode(c.alternate, context);
    }

    case 'MemberExpression': {
      const m = node as jsep.MemberExpression;
      const obj = evalNode(m.object, context) as Record<string, unknown> | unknown[] | null;
      if (obj == null) return undefined;
      const key = m.computed
        ? (evalNode(m.property, context) as string | number)
        : (m.property as jsep.Identifier).name;
      return (obj as Record<string, unknown>)[String(key)];
    }

    case 'CallExpression':
      // Function calls intentionally disabled — keeps the evaluator safe.
      throw new Error('Function calls are not allowed in expressions');

    case 'ThisExpression':
      throw new Error('`this` is not allowed in expressions');

    case 'Compound':
      throw new Error('Compound expressions (with `,` or `;`) are not allowed');

    default:
      throw new Error(`Unsupported expression node: ${node.type}`);
  }
}

function humanError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Plain string-template version of the interpolation engine — re-exported
 * here so consumers importing from this file don't need a second import.
 */
export { interpolate };
