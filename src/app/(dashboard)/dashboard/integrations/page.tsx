import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GoogleIntegrationCard } from '@/components/integrations/google-integration-card';
import { SlackIntegrationCard } from '@/components/integrations/slack-integration-card';
import { NotionIntegrationCard } from '@/components/integrations/notion-integration-card';
import { OAuthResultToast } from '@/components/integrations/oauth-result-toast';
import type { ExistingIntegration } from '@/components/integrations/integration-card';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration, type IntegrationProvider } from '@/lib/db/models';

export const metadata: Metadata = { title: 'Integrations' };

async function loadIntegrations(): Promise<Record<IntegrationProvider, ExistingIntegration | null>> {
  const user = await requireUser();
  await connectDb();
  const docs = await Integration.find({ userId: user._id })
    .sort({ connectedAt: -1 })
    .lean();

  const byProvider: Record<IntegrationProvider, ExistingIntegration | null> = {
    google: null,
    slack: null,
    notion: null,
  };

  for (const doc of docs) {
    if (byProvider[doc.provider] !== null) continue;
    byProvider[doc.provider] = {
      id: String(doc._id),
      displayName: doc.displayName ?? 'Connected account',
      status: doc.status,
      scopes: doc.scopes ?? [],
      connectedAt: doc.connectedAt ? new Date(doc.connectedAt).toISOString() : null,
      lastUsedAt: doc.lastUsedAt ? new Date(doc.lastUsedAt).toISOString() : null,
    };
  }

  return byProvider;
}

export default async function IntegrationsPage() {
  const integrations = await loadIntegrations();
  const connectedCount = Object.values(integrations).filter(Boolean).length;
  const totalProviders = Object.keys(integrations).length;

  return (
    <>
      <Suspense fallback={null}>
        <OAuthResultToast />
      </Suspense>
      <PageHeader
        eyebrow="Connections"
        title="Integrations"
        description="The tools your workflows act on. Connect each one with OAuth and AutoMate stores the tokens encrypted at rest."
        action={
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            AES-256-GCM at rest
          </div>
        }
      />

      <div className="mb-6 flex items-baseline gap-2 text-sm">
        <span className="font-mono text-2xl tabular-nums text-foreground">
          {connectedCount}
        </span>
        <span className="text-muted-foreground">
          of {totalProviders} providers connected
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GoogleIntegrationCard integration={integrations.google} />
        <SlackIntegrationCard integration={integrations.slack} />
        <NotionIntegrationCard integration={integrations.notion} />
      </div>
    </>
  );
}
