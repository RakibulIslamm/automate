import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration, INTEGRATION_PROVIDERS, type IntegrationProvider } from '@/lib/db/models';
import { decryptJSON } from '@/lib/crypto';
import { getGoogleClient } from '@/lib/oauth/google';
import { revokeSlackToken } from '@/lib/oauth/slack';
import { revokeNotionToken } from '@/lib/oauth/notion';
import { logError } from '@/lib/tracking/log-error';
import { trackEvent } from '@/lib/tracking/event';
import type {
  GoogleTokenPayload,
  NotionTokenPayload,
  SlackTokenPayload,
} from '@/lib/oauth/refresh';
import { safeRoute } from '@/lib/safe-route';

const bodySchema = z.object({
  integrationId: z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid integrationId'),
});

function isProvider(v: string): v is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(v);
}

async function revokeBestEffort(
  provider: IntegrationProvider,
  encryptedTokens: string,
): Promise<void> {
  try {
    switch (provider) {
      case 'google': {
        const payload = decryptJSON<GoogleTokenPayload>(encryptedTokens);
        const tokenToRevoke = payload.refreshToken || payload.accessToken;
        if (tokenToRevoke) await getGoogleClient().revokeToken(tokenToRevoke);
        return;
      }
      case 'slack': {
        const payload = decryptJSON<SlackTokenPayload>(encryptedTokens);
        if (payload.accessToken) await revokeSlackToken(payload.accessToken);
        return;
      }
      case 'notion': {
        const payload = decryptJSON<NotionTokenPayload>(encryptedTokens);
        if (payload.accessToken) await revokeNotionToken(payload.accessToken);
        return;
      }
      default: {
        const _exhaustive: never = provider;
        void _exhaustive;
      }
    }
  } catch (err) {
    // Best-effort. Tampered ciphertext or a network blip shouldn't block the
    // user from removing the integration row.
    // eslint-disable-next-line no-console
    console.warn('[oauth-disconnect] token revocation failed (continuing)', err);
  }
}

export const DELETE = safeRoute<z.infer<typeof bodySchema>, { ok: true }>({
  schema: bodySchema,
  handler: async (input, req) => {
    const url = req.nextUrl;
    const provider = url.pathname.split('/').filter(Boolean).at(-2);
    if (!provider || !isProvider(provider)) {
      throw new NotFoundError(`Unknown integration provider: ${provider}`);
    }

    const user = await requireUser();
    await connectDb();

    const doc = await Integration.findOne({
      _id: new Types.ObjectId(input.integrationId),
      userId: user._id,
      provider,
    });
    if (!doc) throw new ValidationError('Integration not found.');

    await revokeBestEffort(provider, doc.encryptedTokens);

    await Integration.deleteOne({ _id: doc._id });

    await trackEvent('integration.disconnected', {
      userId: String(user._id),
      properties: { provider, integrationId: String(doc._id) },
    }).catch((err) => logError(err, { source: 'oauth-disconnect.trackEvent' }));

    return { ok: true };
  },
});
