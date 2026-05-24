import { z } from 'zod';
import { safeRoute } from '@/lib/safe-route';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { buildWorkflowFromPrompt, type AiBuilderResult } from '@/lib/workflows/ai-builder';
import type {
  AvailableIntegration,
  NotionDatabaseRef,
  SlackChannelRef,
} from '@/lib/ai/prompts/workflow-builder';
import { listDatabasesWithSchema } from '@/lib/integrations/notion';
import { listChannels as listSlackChannels } from '@/lib/integrations/slack';
import { trackEvent } from '@/lib/tracking/event';
import { logError } from '@/lib/tracking/log-error';

const bodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, 'Describe what you want to automate in a few more words.')
    .max(2000, 'Keep your prompt under 2000 characters.'),
});

/**
 * For Notion and Slack, the AI needs concrete ids (database id, channel id)
 * baked into the workflow — emitting `"your_inbox_database_id"` placeholders
 * makes the saved workflow useless at runtime. So before calling the model
 * we fetch the resources each integration can actually reach, and pass them
 * to the prompt. Failures are non-fatal: if the Notion search times out we
 * fall back to the bare integration entry, and the AI then degrades to the
 * "missing integration" path.
 */
// Cap the resources we splice into the prompt. Each list item adds ~80
// chars to the system prompt; we trade exhaustive coverage for keeping
// the prompt + JSON output well within budget-model output limits.
const MAX_NOTION_DATABASES = 30;
const MAX_SLACK_CHANNELS = 30;

async function enrichIntegration(
  base: AvailableIntegration,
): Promise<AvailableIntegration> {
  try {
    if (base.provider === 'notion') {
      const dbs = await listDatabasesWithSchema(base.id);
      const notionDatabases: NotionDatabaseRef[] = dbs
        .slice(0, MAX_NOTION_DATABASES)
        .map((d) => ({
          id: d.id,
          title: d.title,
          columns: d.columns,
        }));
      return { ...base, notionDatabases };
    }
    if (base.provider === 'slack') {
      const channels = await listSlackChannels(base.id);
      const slackChannels: SlackChannelRef[] = channels
        .filter((c) => c.id && c.name)
        // Public channels first, then private — keeps the most-likely-
        // referenced channels in the truncated head of the list.
        .sort((a, b) => Number(a.is_private) - Number(b.is_private))
        .slice(0, MAX_SLACK_CHANNELS)
        .map((c) => ({ id: c.id, name: c.name }));
      return { ...base, slackChannels };
    }
  } catch (err) {
    await logError(err, {
      source: 'workflows.build.enrichIntegration',
      extra: { integrationId: base.id, provider: base.provider },
    });
  }
  return base;
}

export const POST = safeRoute<z.infer<typeof bodySchema>, AiBuilderResult>({
  schema: bodySchema,
  handler: async ({ prompt }) => {
    const user = await requireUser();
    await connectDb();

    const integrationDocs = await Integration.find({
      userId: user._id,
      status: 'active',
    })
      .select('_id provider displayName')
      .lean();

    const base: AvailableIntegration[] = integrationDocs.map((doc) => ({
      id: String(doc._id),
      provider: doc.provider,
      displayName: doc.displayName ?? `${doc.provider} account`,
    }));

    // Enrich Notion + Slack entries in parallel so the build call doesn't
    // serialize two upstream round-trips.
    const availableIntegrations = await Promise.all(base.map(enrichIntegration));

    const result = await buildWorkflowFromPrompt({
      userPrompt: prompt,
      userId: String(user._id),
      availableIntegrations,
    });

    await trackEvent('workflow.ai_built', {
      userId: String(user._id),
      properties: {
        prompt: prompt.slice(0, 500),
        steps: result.definition.steps.length,
        trigger: result.definition.trigger.type,
        missing: result.definition.steps.length === 0,
      },
    }).catch(() => {});

    return result;
  },
});
