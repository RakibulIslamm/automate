import 'server-only';
import type { IntegrationProvider } from '@/lib/db/models';

/**
 * Static, provider-facing strings used by the OAuth route handlers and UI.
 * Keeps the connect/callback files free of provider-specific copy.
 */

export interface ProviderConfig {
  /** Human-friendly name, e.g. "Google Workspace". */
  label: string;
  /** Short noun used inline in toasts, e.g. "Google". */
  shortLabel: string;
}

export const PROVIDER_CONFIG: Record<IntegrationProvider, ProviderConfig> = {
  google: { label: 'Google Workspace', shortLabel: 'Google' },
  slack: { label: 'Slack', shortLabel: 'Slack' },
  notion: { label: 'Notion', shortLabel: 'Notion' },
};
