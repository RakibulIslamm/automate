import {
  CreditCard,
  Gauge,
  History,
  LayoutGrid,
  Plug,
  Settings,
  ShieldAlert,
  Users,
  Activity,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Shared nav config consumed by both the sidebar and the command palette.
 * Keep this file dependency-light so it can be imported from server and
 * client components.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const DASHBOARD_NAV_MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: Gauge, description: 'At-a-glance status' },
  { href: '/dashboard/workflows', label: 'Workflows', icon: Workflow, description: 'Build and manage automations' },
  { href: '/dashboard/runs', label: 'Runs', icon: History, description: 'Execution history' },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug, description: 'Connect Gmail, Slack, Notion…' },
];

export const DASHBOARD_NAV_BOTTOM: NavItem[] = [
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutGrid, description: 'Admin home' },
  { href: '/admin/errors', label: 'Errors', icon: ShieldAlert, description: 'ErrorLog stream' },
  { href: '/admin/events', label: 'Events', icon: Activity, description: 'EventLog stream' },
  { href: '/admin/users', label: 'Users', icon: Users, description: 'User accounts' },
];
