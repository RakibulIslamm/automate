/**
 * Sanity tests for the workflow DSL, interpolation, expression evaluator,
 * and validator. Not a real test suite — run with `pnpm exec tsx scripts/test-dsl.ts`.
 * Prints PASS/FAIL lines and exits with a non-zero code if anything failed.
 */

import { interpolate, interpolateValue, getByPath } from '@/lib/workflows/interpolate';
import { evaluateExpression } from '@/lib/workflows/expression';
import { validateWorkflow } from '@/lib/workflows/validator';
import { WORKFLOW_TEMPLATES } from '@/lib/workflows/templates';
import type { WorkflowDefinition } from '@/lib/workflows/dsl';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass++;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${label}${detail !== undefined ? `\n    detail: ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n— ${title} —`);
}

/* ─────────────────── interpolation ─────────────────── */

section('interpolate');
check(
  'simple replacement',
  interpolate('Hello {{name}}', { name: 'World' }) === 'Hello World',
);
check(
  'nested replacement',
  interpolate('Hi {{trigger.email.from.name}}', {
    trigger: { email: { from: { name: 'Alice' } } },
  }) === 'Hi Alice',
);
check(
  'array .length',
  interpolate('Count: {{items.length}}', { items: [1, 2, 3] }) === 'Count: 3',
);
check(
  'array [index]',
  interpolate('First: {{xs[0]}}', { xs: ['apple', 'pear'] }) === 'First: apple',
);
check(
  'missing path renders empty',
  interpolate('Hi {{missing.path}}!', {}) === 'Hi !',
);
check(
  'multiple refs in one string',
  interpolate('{{a}} and {{b}}', { a: 'x', b: 'y' }) === 'x and y',
);
check(
  'number coerced to string',
  interpolate('Total: {{n}}', { n: 42 }) === 'Total: 42',
);
check(
  'object becomes JSON',
  interpolate('Payload: {{o}}', { o: { k: 1 } }) === 'Payload: {"k":1}',
);

section('interpolateValue');
const renderedObj = interpolateValue(
  { subject: '{{topic}}', count: '{{n}}', deep: { name: '{{user.name}}' } },
  { topic: 'Hello', n: 5, user: { name: 'Alice' } },
);
check(
  'recursively renders strings inside objects',
  JSON.stringify(renderedObj) ===
    JSON.stringify({ subject: 'Hello', count: 5, deep: { name: 'Alice' } }),
  renderedObj,
);
const renderedArr = interpolateValue(['{{a}}', '{{b}}'], { a: 1, b: 2 });
check('renders arrays', JSON.stringify(renderedArr) === JSON.stringify([1, 2]), renderedArr);

section('getByPath');
check('getByPath array indexing', getByPath({ xs: [{ v: 9 }] }, 'xs[0].v') === 9);
check('getByPath missing returns undefined', getByPath({}, 'missing') === undefined);

/* ─────────────────── expression eval ─────────────────── */

section('evaluateExpression');
check(
  'numeric comparison',
  evaluateExpression('{{count}} > 5', { count: 10 }).value === true,
);
check(
  'numeric comparison false',
  evaluateExpression('{{count}} > 5', { count: 3 }).value === false,
);
check(
  'string equality',
  evaluateExpression('{{status}} == "open"', { status: 'open' }).value === true,
);
check(
  'logical AND',
  evaluateExpression('{{a}} > 0 && {{b}} < 10', { a: 1, b: 5 }).value === true,
);
check(
  'logical OR short-circuit',
  evaluateExpression('{{a}} == 1 || {{b}} == 1', { a: 1, b: 999 }).value === true,
);
check(
  'unary not on missing → null is falsy',
  evaluateExpression('!{{missing}}', {}).value === true,
);
check(
  'arithmetic precedence',
  evaluateExpression('{{a}} + 2 * 3 > 6', { a: 1 }).value === true,
);
check(
  'rejects function calls',
  (evaluateExpression('process.exit(1)', {}).error ?? '').includes('Function calls'),
);
check(
  'parse error reported',
  Boolean(evaluateExpression('{{count}} > > 5', { count: 1 }).error),
);

/* ─────────────────── validator ─────────────────── */

section('validateWorkflow — valid');
const validIntegrationIds = new Set<string>(['<google>', '<slack>', '<notion>']);

for (const tpl of WORKFLOW_TEMPLATES) {
  const res = validateWorkflow(tpl.definition, { validIntegrationIds });
  check(
    `template "${tpl.id}" parses cleanly`,
    res.ok,
    res.ok ? undefined : res.errors,
  );
}

section('validateWorkflow — invalid');

// Missing trigger
const noTrigger = { steps: [{ id: 's', type: 'manual', config: {} }] };
{
  const res = validateWorkflow(noTrigger);
  check('rejects missing trigger', !res.ok && res.errors.some((e) => e.includes('trigger')), res);
}

// Duplicate step ids
const dupIds: WorkflowDefinition = {
  trigger: { type: 'manual', config: {} },
  steps: [
    {
      id: 'dup',
      type: 'slack.post_message',
      config: { integrationId: '<slack>', channel: '#g', messageTemplate: 'hi' },
    },
    {
      id: 'dup',
      type: 'slack.post_message',
      config: { integrationId: '<slack>', channel: '#g', messageTemplate: 'hi again' },
    },
  ],
};
{
  const res = validateWorkflow(dupIds, { validIntegrationIds });
  check(
    'rejects duplicate step ids',
    !res.ok && res.errors.some((e) => e.includes('Duplicate step id')),
    res,
  );
}

// Template ref to a step that doesn't exist yet
const forwardRef: WorkflowDefinition = {
  trigger: { type: 'manual', config: {} },
  steps: [
    {
      id: 'first',
      type: 'slack.post_message',
      config: {
        integrationId: '<slack>',
        channel: '#g',
        // References "later" which is the NEXT step — invalid forward ref.
        messageTemplate: 'about to do: {{later.thing}}',
      },
    },
    {
      id: 'later',
      type: 'slack.post_message',
      config: {
        integrationId: '<slack>',
        channel: '#g',
        messageTemplate: 'done',
      },
    },
  ],
};
{
  const res = validateWorkflow(forwardRef, { validIntegrationIds });
  check(
    'rejects forward template ref',
    !res.ok && res.errors.some((e) => e.includes('doesn\'t exist before')),
    res,
  );
}

// Unknown integration id
const badIntegration: WorkflowDefinition = {
  trigger: { type: 'manual', config: {} },
  steps: [
    {
      id: 'send',
      type: 'slack.post_message',
      config: {
        integrationId: 'nope-not-a-real-id',
        channel: '#g',
        messageTemplate: 'hi',
      },
    },
  ],
};
{
  const res = validateWorkflow(badIntegration, { validIntegrationIds });
  check(
    'rejects unknown integration id',
    !res.ok && res.errors.some((e) => e.includes('integrationId')),
    res,
  );
}

// Bad expression in condition.if
const badExpr: WorkflowDefinition = {
  trigger: { type: 'manual', config: {} },
  steps: [
    {
      id: 'check',
      type: 'condition.if',
      config: {
        // Unmatched parens — jsep will throw.
        expression: '((1 + 2',
        then: [
          {
            id: 'inside',
            type: 'slack.post_message',
            config: { integrationId: '<slack>', channel: '#g', messageTemplate: 'ok' },
          },
        ],
      },
    },
  ],
};
{
  const res = validateWorkflow(badExpr, { validIntegrationIds });
  check(
    'rejects unparseable expression',
    !res.ok && res.errors.some((e) => e.includes('invalid expression')),
    res,
  );
}

/* ─────────────────── summary ─────────────────── */

// eslint-disable-next-line no-console
console.log(`\n${pass} pass · ${fail} fail`);
if (fail > 0) process.exit(1);
