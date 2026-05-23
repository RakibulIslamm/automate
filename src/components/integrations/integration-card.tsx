'use client';

import { useTransition, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Loader2, Plug, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog';
import { testIntegration } from '@/server/actions/integrations';

interface ScopeBadge {
  key: string;
  label: string;
}

/**
 * Maps raw scope strings to friendly labels, then de-duplicates by label —
 * Google returns both `email` and `https://www.googleapis.com/auth/userinfo.email`
 * which would otherwise render as twin badges. Unknown scopes fall back to
 * the trailing path segment (or the raw string for non-URL scopes).
 */
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

const STATUS_VARIANTS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  active: { label: 'Active', variant: 'default' },
  expired: { label: 'Expired — reconnect', variant: 'destructive' },
  revoked: { label: 'Revoked', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
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
  /** e.g. "Google Workspace" — shown as the card title. */
  title: string;
  /** Used inside the disconnect/test toasts — e.g. "Google", "Slack". */
  shortLabel: string;
  description: string;
  /** Icon node — branded SVG, sized to the slot. */
  icon: ReactNode;
  /**
   * Icon "chip" background — Google needs white, Slack/Notion look better on
   * the muted palette. Caller picks via Tailwind utility classes.
   */
  iconWrapperClassName?: string;
  /** Bullet-point copy shown when not connected. */
  features: string[];
  /** "Account" label in the connected-state details (e.g. "Workspace"). */
  accountLabel?: string;
  scopeLabels?: Record<string, string>;
  /**
   * Label shown for the scope/feature row in the connected state. Falsy
   * skips the badges entirely (Notion has no granular scopes).
   */
  scopeListLabel?: string | null;
  integration: ExistingIntegration | null;
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
}: IntegrationCardProps) {
  const [pending, startTransition] = useTransition();
  const connected = integration !== null;
  const statusInfo = integration ? STATUS_VARIANTS[integration.status] ?? STATUS_VARIANTS.error : null;

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
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div
            className={`grid size-12 shrink-0 place-items-center rounded-xl shadow-sm ${iconWrapperClassName}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              {title}
              {connected && statusInfo ? (
                <Badge
                  variant={statusInfo.variant === 'default' ? 'secondary' : statusInfo.variant}
                >
                  {statusInfo.label}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {connected && integration ? (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {accountLabel}
                </dt>
                <dd className="mt-0.5 truncate font-medium">{integration.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Connected
                </dt>
                <dd className="mt-0.5">
                  {integration.connectedAt
                    ? format(new Date(integration.connectedAt), 'PP')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Last used
                </dt>
                <dd className="mt-0.5">
                  {integration.lastUsedAt
                    ? format(new Date(integration.lastUsedAt), 'PP p')
                    : 'Not yet'}
                </dd>
              </div>
            </dl>
            {scopeListLabel && integration.scopes.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {scopeListLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dedupeScopeLabels(integration.scopes, scopeLabels).map(
                    ({ key, label }) => (
                      <Badge key={key} variant="outline" className="font-normal">
                        {label}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <ul className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Sparkles className="size-4" aria-hidden /> {feature}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t pt-6">
        {connected && integration ? (
          <>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Testing…
                </>
              ) : (
                'Test connection'
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
            <Button size="sm" asChild>
              <a href={`/api/oauth/${provider}/connect`}>
                Reconnect
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </>
        ) : (
          <Button asChild>
            <a href={`/api/oauth/${provider}/connect`}>
              <Plug className="size-4" />
              Connect {shortLabel}
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
