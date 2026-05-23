'use client';

import { ShieldAlert } from 'lucide-react';
import { DesktopSidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';
import {
  DASHBOARD_NAV_BOTTOM,
  DASHBOARD_NAV_MAIN,
  type NavItem,
} from './nav-config';

/**
 * Client-side dashboard shell. The layout above is a server component (auth
 * gating + DB lookup) and passes us plain-object props only. The shell owns
 * the nav config — that way the `icon: LucideIcon` field never has to cross
 * the server→client boundary.
 */
export interface DashboardShellProps {
  user: { name?: string; email?: string; image?: string };
  isAdmin: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ user, isAdmin, children }: DashboardShellProps) {
  const bottomItems: NavItem[] = [...DASHBOARD_NAV_BOTTOM];
  if (isAdmin) {
    bottomItems.push({ href: '/admin', label: 'Admin', icon: ShieldAlert });
  }

  return (
    <div className="min-h-svh bg-background">
      <DesktopSidebar mainItems={DASHBOARD_NAV_MAIN} bottomItems={bottomItems} />
      <div className="flex min-h-svh flex-col lg:pl-60">
        <Topbar user={user} mainItems={DASHBOARD_NAV_MAIN} bottomItems={bottomItems} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
