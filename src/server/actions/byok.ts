'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/safe-action';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  ByokKey,
  BYOK_AI_PROVIDERS,
  type ByokAiProvider,
  type ByokStatus,
} from '@/lib/db/models';
import { encrypt, decrypt } from '@/lib/crypto';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { testAiProviderKey, looksLikeValidKey } from '@/lib/byok/providers';
import { AI_MODELS } from '@/lib/byok/pricing';
import { last4 } from '@/lib/byok/sanitize';
import { trackEvent } from '@/lib/tracking/event';

/**
 * BYOK server actions — save, test, remove the per-user provider keys.
 * The actions stay tight: they validate the key shape, run the test
 * connection, encrypt+persist, and revalidate the Settings route.
 *
 * Never log the raw key. Errors from this module flow through `safeAction`
 * which already strips internal codes — but if you add new console logs,
 * wrap with `redactSecrets` from `@/lib/byok/sanitize`.
 */

const aiProviderSchema = z.enum(BYOK_AI_PROVIDERS);

const saveAiSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().min(20, 'API key looks too short.').max(500),
  model: z.string().min(1).optional(),
});

export const saveByokAiKey = safeAction(saveAiSchema, async ({ provider, apiKey, model }) => {
  const user = await requireUser();

  if (!looksLikeValidKey(provider, apiKey)) {
    throw new ValidationError("That doesn't look like a key for this provider.", {
      apiKey: `Expected a key starting with one of: ${expectedPrefixes(provider)}`,
    });
  }
  if (model && !AI_MODELS[provider].some((m) => m.id === model)) {
    throw new ValidationError('Unknown model for this provider.', { model: 'Pick from the list.' });
  }

  // Live-test the key before persisting. Cheapest no-op per provider.
  const probe = await testAiProviderKey(provider, apiKey);
  if (probe.status !== 'active') {
    throw new ValidationError(probe.message, { apiKey: probe.message });
  }

  await connectDb();
  await ByokKey.updateOne(
    { userId: user._id, provider },
    {
      $set: {
        encryptedKey: encrypt(apiKey),
        selectedModel: model,
        last4: last4(apiKey),
        status: 'active' as ByokStatus,
        lastTestedAt: new Date(),
      },
      $setOnInsert: { userId: user._id, provider },
    },
    { upsert: true },
  );

  await trackEvent('byok.key.saved', {
    userId: String(user._id),
    properties: { provider, model: model ?? null },
  }).catch(() => {});

  revalidatePath('/dashboard/byok');
  revalidatePath('/dashboard/settings');
  return { ok: true as const, provider, status: 'active' as ByokStatus };
});

const providerSchema = z.object({
  provider: z.enum(BYOK_AI_PROVIDERS),
});

export const testByokKey = safeAction(providerSchema, async ({ provider }) => {
  const user = await requireUser();
  await connectDb();
  const row = await ByokKey.findOne({ userId: user._id, provider });
  if (!row) throw new NotFoundError('No key saved for this provider.');

  const probe = await testAiProviderKey(provider as ByokAiProvider, decrypt(row.encryptedKey));
  row.status = probe.status;
  row.lastTestedAt = new Date();
  await row.save();

  return { status: probe.status, message: probe.message };
});

export const removeByokKey = safeAction(providerSchema, async ({ provider }) => {
  const user = await requireUser();
  await connectDb();
  await ByokKey.deleteOne({ userId: user._id, provider });
  revalidatePath('/dashboard/byok');
  revalidatePath('/dashboard/settings');
  return { ok: true as const };
});

function expectedPrefixes(provider: ByokAiProvider): string {
  switch (provider) {
    case 'openai':
      return 'sk-';
    case 'anthropic':
      return 'sk-ant-';
    case 'openrouter':
      return 'sk-or-';
    case 'deepseek':
      return 'sk-';
  }
}
