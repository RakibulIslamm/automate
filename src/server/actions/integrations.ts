'use server';

import { Types } from 'mongoose';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/safe-action';
import { requireUser } from '@/lib/auth/guards';
import { NotFoundError } from '@/lib/errors';
import { connectDb } from '@/lib/db/connect';
import { Integration, type IntegrationDoc } from '@/lib/db/models';
import { getProfile as getGmailProfile } from '@/lib/integrations/gmail';
import { authTest as slackAuthTest } from '@/lib/integrations/slack';
import { getMe as notionMe } from '@/lib/integrations/notion';

const integrationIdSchema = z.object({
  integrationId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), 'Invalid integrationId'),
});

export interface TestIntegrationResult {
  ok: boolean;
  message: string;
  /** Snapshot of the provider profile when ok=true; empty string when not. */
  detail: string;
}

async function probe(doc: IntegrationDoc): Promise<TestIntegrationResult> {
  const integrationId = String(doc._id);
  switch (doc.provider) {
    case 'google': {
      const profile = await getGmailProfile(integrationId);
      return {
        ok: true,
        message: 'Google connection is healthy.',
        detail: profile.emailAddress,
      };
    }
    case 'slack': {
      const info = await slackAuthTest(integrationId);
      return {
        ok: true,
        message: 'Slack connection is healthy.',
        detail: `${info.team} · @${info.user}`,
      };
    }
    case 'notion': {
      const me = await notionMe(integrationId);
      return {
        ok: true,
        message: 'Notion connection is healthy.',
        detail: me.workspace_name ? `Workspace: ${me.workspace_name}` : `Bot: ${me.name}`,
      };
    }
    default: {
      const _exhaustive: never = doc.provider;
      throw new NotFoundError(`Unsupported provider: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Smoke-test an integration by doing the cheapest API call we can. Provider
 * dispatch:
 *  - google → `gmail.users.getProfile`
 *  - slack  → `auth.test`
 *  - notion → `users.me`
 *
 * Updates the Integration row's `status` based on the outcome (active on
 * success, error on failure). The action result itself is always
 * `{ ok: true }` from `safeAction`'s POV — the payload's own `ok` flag tells
 * the UI which toast to show.
 */
export const testIntegration = safeAction(
  integrationIdSchema,
  async ({ integrationId }): Promise<TestIntegrationResult> => {
    const user = await requireUser();
    await connectDb();

    const _id = new Types.ObjectId(integrationId);
    const doc = await Integration.findOne({ _id, userId: user._id });
    if (!doc) throw new NotFoundError('Integration not found.');

    try {
      const result = await probe(doc);
      await Integration.updateOne(
        { _id },
        { $set: { status: 'active', lastUsedAt: new Date() } },
      );
      revalidatePath('/dashboard/integrations');
      return result;
    } catch (err) {
      await Integration.updateOne({ _id }, { $set: { status: 'error' } });
      revalidatePath('/dashboard/integrations');
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Integration test failed. Try reconnecting.',
        detail: '',
      };
    }
  },
);
