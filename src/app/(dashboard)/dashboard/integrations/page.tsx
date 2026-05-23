import type { Metadata } from 'next';
import { Suspense } from 'react';
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
    // First (most recent) doc wins per provider.
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

  return (
    <>
      <Suspense fallback={null}>
        <OAuthResultToast />
      </Suspense>
      <PageHeader
        title="Integrations"
        description="Connect the accounts your workflows act on — Gmail, Drive, Slack, Notion, Calendar."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GoogleIntegrationCard integration={integrations.google} />
        <SlackIntegrationCard integration={integrations.slack} />
        <NotionIntegrationCard integration={integrations.notion} />
      </div>
    </>
  );
}
