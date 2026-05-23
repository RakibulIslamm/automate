'use client';

import { DesktopSidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';
import { ADMIN_NAV } from './nav-config';

export interface AdminShellProps {
  user: { name?: string; email?: string; image?: string };
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <DesktopSidebar
        mainItems={ADMIN_NAV}
        bottomItems={[]}
        brand="Admin"
        brandHref="/admin"
      />
      <div className="flex min-h-svh flex-col lg:pl-60">
        <Topbar
          user={user}
          mainItems={ADMIN_NAV}
          bottomItems={[]}
          brand="Admin"
          brandHref="/admin"
        />
        {/* Warm accent strip to differentiate /admin from /dashboard */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
