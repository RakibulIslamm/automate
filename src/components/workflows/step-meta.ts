import type { LucideIcon } from 'lucide-react';
import {
  Calendar as CalendarIcon,
  FileUp,
  FolderPlus,
  GitBranch,
  Hand,
  Inbox,
  Mail,
  MessageSquare,
  NotebookText,
  Send,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { Step, StepType, Trigger, TriggerType } from '@/lib/workflows/dsl';

/**
 * Human-readable metadata for triggers and steps. Powers the flowchart, the
 * edit dialog, and any list views — single source of truth so renaming
 * "Send Email" everywhere is a one-line change.
 */

export interface NodeMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind-ready bg-* class (matches the accent ring/icon background). */
  accent: string;
}

export const TRIGGER_META: Record<TriggerType, NodeMeta> = {
  manual: { label: 'Run on demand', icon: Hand, accent: 'bg-zinc-100 dark:bg-zinc-800' },
  'schedule.cron': {
    label: 'On a schedule',
    icon: Timer,
    accent: 'bg-amber-50 dark:bg-amber-950/40',
  },
  'gmail.email_received': {
    label: 'New Gmail message',
    icon: Inbox,
    accent: 'bg-red-50 dark:bg-red-950/40',
  },
};

export const STEP_META: Record<StepType, NodeMeta> = {
  'gmail.get_attachments': {
    label: 'Get Gmail attachments',
    icon: Mail,
    accent: 'bg-red-50 dark:bg-red-950/40',
  },
  'gmail.send_email': {
    label: 'Send Gmail',
    icon: Send,
    accent: 'bg-red-50 dark:bg-red-950/40',
  },
  'drive.upload_file': {
    label: 'Upload to Drive',
    icon: FileUp,
    accent: 'bg-yellow-50 dark:bg-yellow-950/40',
  },
  'drive.create_folder': {
    label: 'Create Drive folder',
    icon: FolderPlus,
    accent: 'bg-yellow-50 dark:bg-yellow-950/40',
  },
  'slack.post_message': {
    label: 'Post to Slack',
    icon: MessageSquare,
    accent: 'bg-violet-50 dark:bg-violet-950/40',
  },
  'notion.create_page': {
    label: 'Create Notion page',
    icon: NotebookText,
    accent: 'bg-zinc-100 dark:bg-zinc-800',
  },
  'calendar.create_event': {
    label: 'Create Calendar event',
    icon: CalendarIcon,
    accent: 'bg-blue-50 dark:bg-blue-950/40',
  },
  'ai.transform': {
    label: 'AI transform',
    icon: Sparkles,
    accent: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
  },
  'condition.if': {
    label: 'Condition',
    icon: GitBranch,
    accent: 'bg-teal-50 dark:bg-teal-950/40',
  },
};

/**
 * Short one-line summary of a step or trigger config, used as subtitle text
 * on the flowchart cards. Keep these under ~80 chars — the card truncates
 * with ellipsis on overflow.
 */
export function summarizeStep(step: Step): string {
  switch (step.type) {
    case 'gmail.get_attachments':
      return `from ${step.config.messageIdFrom}`;
    case 'gmail.send_email':
      return `to ${step.config.toTemplate} — ${step.config.subjectTemplate}`;
    case 'drive.upload_file':
      return `${step.config.fileFrom} → ${step.config.folderName ?? step.config.folderId}`;
    case 'drive.create_folder':
      return step.config.name;
    case 'slack.post_message':
      return `${step.config.channel}: ${step.config.messageTemplate}`;
    case 'notion.create_page':
      return `database ${step.config.databaseId}`;
    case 'calendar.create_event':
      return `${step.config.summary} @ ${step.config.startTimeTemplate}`;
    case 'ai.transform':
      return step.config.instruction;
    case 'condition.if':
      return `if ${step.config.expression}`;
  }
}

export function summarizeTrigger(trigger: Trigger): string {
  switch (trigger.type) {
    case 'manual':
      return 'Triggered manually from the dashboard.';
    case 'schedule.cron':
      return `cron \`${trigger.config.cron}\` in ${trigger.config.timezone}`;
    case 'gmail.email_received':
      return `query: ${trigger.config.query}`;
  }
}
