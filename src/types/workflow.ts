/**
 * Re-export of the workflow DSL types so consumers throughout the app can
 * import from a stable `@/types/workflow` path without reaching into
 * `@/lib/workflows/...` directly.
 *
 * Runtime helpers (validator, interpolation, expression evaluator) stay in
 * `@/lib/workflows` — only types should come from here.
 */

export type {
  WorkflowDefinition,
  Trigger,
  TriggerType,
  ManualTrigger,
  ScheduleCronTrigger,
  GmailEmailReceivedTrigger,
  Step,
  StepType,
  StepOfType,
  TriggerOfType,
  ConditionIfStep,
} from '@/lib/workflows/dsl';

export { TRIGGER_TYPES, STEP_TYPES } from '@/lib/workflows/dsl';
