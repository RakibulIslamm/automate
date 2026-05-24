import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Types } from 'mongoose';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import {
  ByokKey,
  BYOK_AI_PROVIDERS,
  type ByokAiProvider,
  type ByokStatus,
} from '@/lib/db/models';
import { env } from '@/lib/env';
import { ByokAiSection, type ByokAiKeyView } from '@/components/byok/byok-ai-section';

export const metadata: Metadata = { title: 'BYOK' };

/**
 * Dedicated BYOK (Bring Your Own Key) configuration page. Only mounted
 * when the project is running in demo mode (`BYOK_ENABLE=true`). When
 * production is on, the page returns 404 so the route can't be probed.
 */
export default async function ByokPage() {
  if (!env.BYOK_ENABLE) notFound();

  const user = await requireUser();
  const aiKeys = await loadAiKeys(String(user._id));

  return (
    <>
      <PageHeader
        eyebrow="Demo mode"
        title="Bring your own key"
        description="This portfolio runs on visitor-supplied API keys so demo traffic doesn't burn the project owner's credits. Drop in your own keys below — they're encrypted at rest with AES-256-GCM and only used to make calls for your account."
        action={
          <span className="hidden items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            Encrypted at rest
          </span>
        }
      />

      <section>
        <SectionHeader title="AI provider" />
        <ByokAiSection keys={aiKeys} />
      </section>
    </>
  );
}

async function loadAiKeys(
  userId: string,
): Promise<Partial<Record<ByokAiProvider, ByokAiKeyView>>> {
  await connectDb();
  const rows = await ByokKey.find({ userId: new Types.ObjectId(userId) }).lean();
  const aiKeys: Partial<Record<ByokAiProvider, ByokAiKeyView>> = {};

  for (const row of rows) {
    if (!BYOK_AI_PROVIDERS.includes(row.provider as ByokAiProvider)) continue;
    aiKeys[row.provider as ByokAiProvider] = {
      provider: row.provider as ByokAiProvider,
      last4: row.last4,
      selectedModel: row.selectedModel ?? null,
      status: (row.status ?? 'untested') as ByokStatus,
      lastTestedAt: row.lastTestedAt ? new Date(row.lastTestedAt).toISOString() : null,
    };
  }

  return aiKeys;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
    </div>
  );
}
