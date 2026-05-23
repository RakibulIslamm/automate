import type { Metadata } from 'next';
import { Plug } from 'lucide-react';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Integrations' };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect the accounts your workflows act on — Gmail, Drive, Slack, Notion, Calendar."
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          icon={<Plug className="h-8 w-8" aria-hidden />}
          title="Nothing connected yet"
          description="Connect your tools to start automating. Integration OAuth flows land in Phase 6."
        />
      </div>
    </>
  );
}
