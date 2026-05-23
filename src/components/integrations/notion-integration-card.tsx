'use client';

import { IntegrationCard, type ExistingIntegration } from './integration-card';
import { NotionIcon } from './notion-icon';

export interface NotionIntegrationCardProps {
  integration: ExistingIntegration | null;
}

export function NotionIntegrationCard({ integration }: NotionIntegrationCardProps) {
  return (
    <IntegrationCard
      provider="notion"
      title="Notion"
      shortLabel="Notion"
      description="Create pages, update databases, and append blocks to your Notion workspace."
      icon={<NotionIcon className="size-9" />}
      iconWrapperClassName="bg-white ring-1 ring-border"
      features={[
        'Create pages',
        'Query databases',
        'Append blocks',
        'Workspace-scoped access',
      ]}
      accountLabel="Workspace"
      scopeListLabel={null}
      integration={integration}
    />
  );
}
