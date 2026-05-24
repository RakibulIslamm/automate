'use client';

import { Info, AlertTriangle } from 'lucide-react';
import { IntegrationCard, type ExistingIntegration } from './integration-card';
import { SlackIcon } from './slack-icon';

const SCOPE_LABELS: Record<string, string> = {
  'chat:write': 'Post messages',
  'channels:read': 'Read public channels',
  'channels:join': 'Join public channels',
  'groups:read': 'Read private channels',
  'users:read': 'Read users',
};

/** Scopes the bot needs to behave correctly. If any of these are missing
 * from the stored integration, the user must reconnect to grant them. */
const REQUIRED_SLACK_SCOPES = ['chat:write', 'channels:join'] as const;

export interface SlackIntegrationCardProps {
  integration: ExistingIntegration | null;
}

export function SlackIntegrationCard({ integration }: SlackIntegrationCardProps) {
  const missingScopes = integration
    ? REQUIRED_SLACK_SCOPES.filter((s) => !integration.scopes.includes(s))
    : [];
  const needsReconnect = integration !== null && missingScopes.length > 0;

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
        'Auto-join public channels',
        'List public + private channels',
        'Encrypted bot token',
      ]}
      accountLabel="Workspace"
      scopeLabels={SCOPE_LABELS}
      scopeListLabel="Bot scopes"
      integration={integration}
      notice={integration ? <SlackNotice needsReconnect={needsReconnect} /> : null}
    />
  );
}

function SlackNotice({ needsReconnect }: { needsReconnect: boolean }) {
  return (
    <div className="space-y-2">
      {needsReconnect ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong>Reconnect required.</strong> This connection is missing newer permissions
            (auto-join public channels). Click <em>Reconnect</em> below to grant them — your
            existing workflows keep working.
          </span>
        </div>
      ) : null}

      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-foreground/60" aria-hidden />
        <span>
          <strong className="text-foreground">Posting to a private channel?</strong> Slack
          doesn&apos;t let bots add themselves to private rooms. Open the channel in Slack and
          run <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">/invite @automate</code>{' '}
          once — after that, the bot can post there forever. Public channels are added
          automatically on first run.
        </span>
      </div>
    </div>
  );
}
