'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, Menu, X, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';
import { CommandPalette, openCommandPalette } from './command-palette';
import { DASHBOARD_NAV_MAIN, DASHBOARD_NAV_BOTTOM, type NavItem } from './nav-config';

/**
 * Editorial top-nav shell — no sidebar. The whole page is content. Section
 * pills sit centered under the brand; the user menu and command-palette hint
 * float right. Active section is underlined with the foreground colour so
 * it reads at a glance without competing with the content.
 *
 * Why no sidebar: the dashboard has 6 sections. A sidebar wastes 240px of
 * width forever for a list short enough to fit in a 56px-tall horizontal
 * strip. Cmd-K covers the deep-navigation case (run ids, workflow ids).
 */
export interface DashboardShellProps {
  user: { name?: string; email?: string; image?: string };
  isAdmin: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ user, isAdmin, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primary: NavItem[] = DASHBOARD_NAV_MAIN;
  const secondary: NavItem[] = [...DASHBOARD_NAV_BOTTOM];
  if (isAdmin) secondary.push({ href: '/admin', label: 'Admin', icon: ShieldAlert });

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-serif text-lg tracking-tight">
            <span className="inline-block size-3 rounded-sm bg-foreground" aria-hidden />
            AutoMate
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCommandPalette()}
              className="hidden items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              aria-label="Open command palette"
            >
              <Command className="size-3.5" aria-hidden />
              <span>Search</span>
              <kbd className="ml-2 rounded-sm border border-border/50 bg-background px-1 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            <UserMenu user={user} />

            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-7xl items-center gap-1 px-4 pb-2 sm:px-6 md:flex lg:px-8" aria-label="Primary">
          {primary.map((item) => (
            <SectionLink key={item.href} item={item} pathname={pathname} />
          ))}
          <div className="mx-2 h-4 w-px bg-border/60" aria-hidden />
          {secondary.map((item) => (
            <SectionLink key={item.href} item={item} pathname={pathname} subtle />
          ))}
        </nav>

        <div
          className={cn(
            'border-t border-border/50 bg-background md:hidden',
            mobileOpen ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {[...primary, ...secondary].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(pathname, item.href)
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openCommandPalette();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Command className="size-4" aria-hidden />
              Search · ⌘K
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>

      <CommandPalette />
    </div>
  );
}

function SectionLink({
  item,
  pathname,
  subtle,
}: {
  item: NavItem;
  pathname: string;
  subtle?: boolean;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        'relative rounded-md px-3 py-1.5 text-sm transition-colors',
        subtle ? 'text-muted-foreground hover:text-foreground' : 'text-foreground/80 hover:text-foreground',
        active && 'text-foreground',
      )}
    >
      {item.label}
      {active ? <span aria-hidden className="absolute inset-x-3 -bottom-2 h-px bg-foreground" /> : null}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
