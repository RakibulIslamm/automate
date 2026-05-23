import type { WorkflowDefinition } from './dsl';

/**
 * Example workflows used as:
 *   - landing-page demos (Phase 12)
 *   - few-shot examples for the AI builder prompt (Phase 9)
 *   - sanity inputs for the DSL validator
 *
 * The integrationId placeholders (`<google>`, `<slack>`, `<notion>`) get
 * substituted with the user's real integration ids by the templates UI
 * before persisting.
 */

export interface WorkflowTemplate {
  /** Stable slug used in URLs and analytics. */
  id: string;
  title: string;
  description: string;
  definition: WorkflowDefinition;
  /**
   * Per-provider integration placeholders embedded in the definition. The
   * "Use this template" flow asks the user to map each placeholder to a
   * connected integration of that provider.
   */
  integrationPlaceholders: Array<{ key: string; provider: 'google' | 'slack' | 'notion' }>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'invoice-to-drive-with-slack-notify',
    title: 'Save invoice attachments to Drive and notify Slack',
    description:
      'Watch Gmail for invoices, save attachments to a Drive folder, then post a summary to Slack.',
    integrationPlaceholders: [
      { key: '<google>', provider: 'google' },
      { key: '<slack>', provider: 'slack' },
    ],
    definition: {
      name: 'Invoice → Drive → Slack',
      description: 'Save Gmail invoice attachments to Drive, ping Slack.',
      trigger: {
        type: 'gmail.email_received',
        config: {
          integrationId: '<google>',
          query: 'from:invoices has:attachment newer_than:1d',
        },
      },
      steps: [
        {
          id: 'attachments',
          type: 'gmail.get_attachments',
          config: {
            integrationId: '<google>',
            messageIdFrom: '{{trigger.message.id}}',
          },
        },
        {
          id: 'has_attachments',
          type: 'condition.if',
          config: {
            expression: '{{attachments.count}} > 0',
            then: [
              {
                id: 'upload',
                type: 'drive.upload_file',
                config: {
                  integrationId: '<google>',
                  folderName: 'Invoices',
                  fileFrom: '{{attachments.items[0]}}',
                  filenameTemplate: 'Invoice — {{trigger.message.subject}}.pdf',
                },
              },
              {
                id: 'notify',
                type: 'slack.post_message',
                config: {
                  integrationId: '<slack>',
                  channel: '#finance',
                  messageTemplate:
                    ':receipt: New invoice saved to Drive: *{{trigger.message.subject}}* — {{upload.webViewLink}}',
                },
              },
            ],
          },
        },
      ],
    },
  },

  {
    id: 'monday-standup-reminder',
    title: 'Monday morning Slack standup reminder',
    description: 'Every Monday at 9 AM, post a standup-reminder message to a Slack channel.',
    integrationPlaceholders: [{ key: '<slack>', provider: 'slack' }],
    definition: {
      name: 'Monday standup reminder',
      description: 'Post a standup reminder every Monday at 9 AM.',
      trigger: {
        type: 'schedule.cron',
        config: {
          cron: '0 9 * * 1',
          timezone: 'America/New_York',
        },
      },
      steps: [
        {
          id: 'remind',
          type: 'slack.post_message',
          config: {
            integrationId: '<slack>',
            channel: '#team',
            messageTemplate:
              ':sun_with_face: *Morning team!* Drop your standup in this thread:\n• What you shipped\n• What you’re working on\n• Any blockers',
          },
        },
      ],
    },
  },

  {
    id: 'gmail-to-notion-log',
    title: 'Log new Gmail emails to a Notion database',
    description:
      'Every new email matching a Gmail filter gets a row in a Notion database with subject, sender, and a brief AI summary.',
    integrationPlaceholders: [
      { key: '<google>', provider: 'google' },
      { key: '<notion>', provider: 'notion' },
    ],
    definition: {
      name: 'Gmail → Notion log',
      description: 'AI-summarize new emails, log to Notion.',
      trigger: {
        type: 'gmail.email_received',
        config: {
          integrationId: '<google>',
          query: 'label:to-log newer_than:1d',
        },
      },
      steps: [
        {
          id: 'summary',
          type: 'ai.transform',
          config: {
            instruction:
              'Summarize this email in one sentence. Keep it under 140 characters. No emojis.',
            inputFrom: '{{trigger.message.snippet}}',
          },
        },
        {
          id: 'log',
          type: 'notion.create_page',
          config: {
            integrationId: '<notion>',
            databaseId: '<notion-database-id>',
            propertiesTemplate: {
              Subject: { title: [{ text: { content: '{{trigger.message.subject}}' } }] },
              From: { rich_text: [{ text: { content: '{{trigger.message.from}}' } }] },
              Summary: { rich_text: [{ text: { content: '{{summary}}' } }] },
              ReceivedAt: { date: { start: '{{trigger.message.receivedAt}}' } },
            },
          },
        },
      ],
    },
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
