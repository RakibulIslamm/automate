import { z } from 'zod';
import { safeRoute } from '@/lib/safe-route';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { buildWorkflowFromPrompt, type AiBuilderResult } from '@/lib/workflows/ai-builder';
import type { AvailableIntegration } from '@/lib/ai/prompts/workflow-builder';
import { trackEvent } from '@/lib/tracking/event';

const bodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, 'Describe what you want to automate in a few more words.')
    .max(2000, 'Keep your prompt under 2000 characters.'),
});

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

    const availableIntegrations: AvailableIntegration[] = integrationDocs.map((doc) => ({
      id: String(doc._id),
      provider: doc.provider,
      displayName: doc.displayName ?? `${doc.provider} account`,
    }));

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
