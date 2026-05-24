'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, Menu, X, Command, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette, openCommandPalette } from './command-palette';
import {
  DASHBOARD_NAV_BOTTOM,
  DASHBOARD_NAV_BYOK,
  DASHBOARD_NAV_MAIN,
  type NavItem,
} from './nav-config';

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
  /** Server-resolved flag (mirrors `env.BYOK_ENABLE`). When true the BYOK
   * nav item is mounted alongside Billing/Settings. Passed from the
   * server layout so users only need to set ONE env var, not a
   * client-mirror as well. */
  byokEnabled?: boolean;
  /** When true, an attention-pill "Set up AI provider" item appears next
   * to the regular nav until the user saves an AI key. */
  byokNeedsAttention?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  isAdmin,
  byokEnabled = false,
  byokNeedsAttention = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primary: NavItem[] = DASHBOARD_NAV_MAIN;
  const secondary: NavItem[] = [...DASHBOARD_NAV_BOTTOM];
  if (byokEnabled) secondary.push(DASHBOARD_NAV_BYOK);
  if (isAdmin) secondary.push({ href: '/admin', label: 'Admin', icon: ShieldAlert });

  // Separate, attention-grabbing nav item — only mounted while the user is
  // in BYOK demo mode and hasn't saved any AI key. Pill-shaped with a rose
  // background so it stands apart from the regular text-link nav items.
  const showSetupAction = byokEnabled && byokNeedsAttention;

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

            <ThemeToggle />

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

          {/* Separate warning-style "set up keys" call to action — pill
              shape, rose background, only mounted while keys are missing.
              Auto-disappears the moment the user saves an AI key. */}
          {showSetupAction ? (
            <Link
              href={DASHBOARD_NAV_BYOK.href}
              aria-label="Set up AI provider"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/15 dark:text-rose-300"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
              </span>
              <AlertTriangle className="size-3" aria-hidden />
              Set up AI provider
            </Link>
          ) : null}
        </nav>

        <div
          className={cn(
            'border-t border-border/50 bg-background md:hidden',
            mobileOpen ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {/* Separate warning item — sits above the regular nav so it's
                the first thing a mobile user sees while demo keys are missing. */}
            {showSetupAction ? (
              <Link
                href={DASHBOARD_NAV_BYOK.href}
                onClick={() => setMobileOpen(false)}
                className="mb-1 flex items-center gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300"
              >
                <AlertTriangle className="size-4" aria-hidden />
                <span className="flex-1">Set up AI provider</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  Required
                </span>
              </Link>
            ) : null}
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
