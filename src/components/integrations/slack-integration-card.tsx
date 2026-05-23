'use client';

import { IntegrationCard, type ExistingIntegration } from './integration-card';
import { SlackIcon } from './slack-icon';

const SCOPE_LABELS: Record<string, string> = {
  'chat:write': 'Post messages',
  'channels:read': 'Read public channels',
  'groups:read': 'Read private channels',
  'users:read': 'Read users',
};

export interface SlackIntegrationCardProps {
  integration: ExistingIntegration | null;
}

export function SlackIntegrationCard({ integration }: SlackIntegrationCardProps) {
  return (
    <IntegrationCard
      provider="slack"
      title="Slack"
      shortLabel="Slack"
      description="Post messages, list channels, and surface workflow updates to your team."
      icon={<SlackIcon className="size-7" />}
      iconWrapperClassName="bg-white ring-1 ring-border"
      features={[
        'Post to channels',
        'List public + private channels',
        'Look up user info',
        'Encrypted bot token',
      ]}
      accountLabel="Workspace"
      scopeLabels={SCOPE_LABELS}
      scopeListLabel="Bot scopes"
      integration={integration}
    />
  );
}
