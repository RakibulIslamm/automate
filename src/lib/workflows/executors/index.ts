import 'server-only';
import type { Step, StepType } from '../dsl';
import type { Executor } from './types';
import { executeGmailGetAttachments } from './gmail-get-attachments';
import { executeGmailSendEmail } from './gmail-send-email';
import { executeDriveUploadFile } from './drive-upload-file';
import { executeDriveCreateFolder } from './drive-create-folder';
import { executeSlackPostMessage } from './slack-post-message';
import { executeNotionCreatePage } from './notion-create-page';
import { executeCalendarCreateEvent } from './calendar-create-event';
import { executeAiTransform } from './ai-transform';
import { executeConditionIf } from './condition-if';

/**
 * Registry mapping step type → executor. The cast back to a generic
 * `Executor<Step>` lets the main loop dispatch uniformly without
 * threading discriminated-union types through every call.
 */
const REGISTRY: Record<StepType, Executor> = {
  'gmail.get_attachments': executeGmailGetAttachments as Executor,
  'gmail.send_email': executeGmailSendEmail as Executor,
  'drive.upload_file': executeDriveUploadFile as Executor,
  'drive.create_folder': executeDriveCreateFolder as Executor,
  'slack.post_message': executeSlackPostMessage as Executor,
  'notion.create_page': executeNotionCreatePage as Executor,
  'calendar.create_event': executeCalendarCreateEvent as Executor,
  'ai.transform': executeAiTransform as Executor,
  'condition.if': executeConditionIf as Executor,
};

export function getExecutor(stepType: StepType): Executor | undefined {
  return REGISTRY[stepType];
}

export function hasExecutor(step: Step): boolean {
  return REGISTRY[step.type as StepType] !== undefined;
}

export type { StepResult, ExecutionContext, Executor } from './types';
