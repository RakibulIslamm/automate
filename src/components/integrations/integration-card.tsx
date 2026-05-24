'use client';

import { useTransition, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog';
import { testIntegration } from '@/server/actions/integrations';

interface ScopeBadge {
  key: string;
  label: string;
}

function dedupeScopeLabels(
  scopes: string[],
  labels: Record<string, string>,
): ScopeBadge[] {
  const seen = new Set<string>();
  const out: ScopeBadge[] = [];
  for (const scope of scopes) {
    const label = labels[scope] ?? fallbackScopeLabel(scope);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ key: scope, label });
  }
  return out;
}

function fallbackScopeLabel(scope: string): string {
  if (scope.startsWith('https://www.googleapis.com/auth/')) {
    return scope.slice('https://www.googleapis.com/auth/'.length);
  }
  return scope;
}

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  active: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  expired: {
    label: 'Reconnect needed',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  revoked: {
    label: 'Revoked',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
  },
  error: {
    label: 'Error',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
  },
};

export interface ExistingIntegration {
  id: string;
  displayName: string;
  status: string;
  scopes: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
}

export interface IntegrationCardProps {
  provider: 'google' | 'slack' | 'notion';
  title: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
  iconWrapperClassName?: string;
  features: string[];
  accountLabel?: string;
  scopeLabels?: Record<string, string>;
  scopeListLabel?: string | null;
  integration: ExistingIntegration | null;
  /** Optional inline notice rendered above the footer — used for
   * provider-specific tips (e.g. Slack's private-channel /invite step). */
  notice?: ReactNode;
}

export function IntegrationCard({
  provider,
  title,
  shortLabel,
  description,
  icon,
  iconWrapperClassName = 'bg-white ring-1 ring-border',
  features,
  accountLabel = 'Account',
  scopeLabels = {},
  scopeListLabel = 'Scopes',
  integration,
  notice,
}: IntegrationCardProps) {
  const [pending, startTransition] = useTransition();
  const connected = integration !== null;
  const statusInfo = integration ? STATUS_META[integration.status] ?? STATUS_META.error : null;

  function handleTest() {
    if (!integration) return;
    startTransition(async () => {
      const result = await testIntegration({ integrationId: integration.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.ok) {
        toast.success(result.data.message, {
          description: result.data.detail || undefined,
        });
      } else {
        toast.error(result.data.message);
      }
    });
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors',
        connected ? 'hover:border-border' : 'hover:border-foreground/30',
      )}
    >
      {/* Top: icon + identity + status */}
      <div className="flex items-start gap-4 p-6">
        <div
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-xl shadow-sm',
            iconWrapperClassName,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl tracking-tight">{title}</h3>
            {statusInfo ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium',
                  statusInfo.text,
                )}
              >
                <span className={cn('size-1.5 rounded-full', statusInfo.dot)} />
                {statusInfo.label}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Body: details when connected, feature list when not */}
      <div className="flex-1 px-6">
        {connected && integration ? (
          <div className="space-y-5 border-t border-border/60 pt-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <Field label={accountLabel}>
                <span className="truncate">{integration.displayName}</span>
              </Field>
              <Field label="Connected">
                {integration.connectedAt
                  ? formatDistanceToNow(new Date(integration.connectedAt), { addSuffix: true })
                  : '—'}
              </Field>
              <Field label="Last used">
                {integration.lastUsedAt
                  ? formatDistanceToNow(new Date(integration.lastUsedAt), { addSuffix: true })
                  : 'Not yet'}
              </Field>
              {scopeListLabel && integration.scopes.length > 0 ? (
                <Field label={scopeListLabel}>
                  <span className="tabular-nums">{dedupeScopeLabels(integration.scopes, scopeLabels).length} permissions</span>
                </Field>
              ) : null}
            </dl>

            {scopeListLabel && integration.scopes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {dedupeScopeLabels(integration.scopes, scopeLabels).map(({ key, label }) => (
                  <span
                    key={key}
                    className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2 border-t border-border/60 pt-5 text-sm">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-muted-foreground">
                <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-foreground/30" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice ? <div className="mt-5 px-6">{notice}</div> : null}

      {/* Footer actions */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-1 border-t border-border/60 bg-muted/20 px-3 py-2">
        {connected && integration ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleTest} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Testing
                </>
              ) : (
                'Test'
              )}
            </Button>
            <DisconnectConfirmDialog
              provider={provider}
              providerLabel={shortLabel}
              integrationId={integration.id}
              trigger={
                <Button variant="ghost" size="sm">
                  Disconnect
                </Button>
              }
            />
            <div className="mx-1 h-4 w-px bg-border/70" aria-hidden />
            <Button size="sm" asChild>
              <a href={`/api/oauth/${provider}/connect`}>
                Reconnect
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </>
        ) : (
          <Button size="sm" asChild>
            <a href={`/api/oauth/${provider}/connect`}>
              <Plug className="size-3.5" />
              Connect {shortLabel}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium">{children}</dd>
    </div>
  );
}
