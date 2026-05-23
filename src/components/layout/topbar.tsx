'use client';

import { Search } from 'lucide-react';
import { Breadcrumbs } from './breadcrumbs';
import { MobileSidebar } from './mobile-sidebar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu, type UserMenuProps } from './user-menu';
import { openCommandPalette } from './command-palette';
import { Button } from '@/components/ui/button';
import type { NavItem } from './nav-config';

export interface TopbarProps extends UserMenuProps {
  mainItems: NavItem[];
  bottomItems: NavItem[];
  brand?: 'AutoMate' | 'Admin';
  brandHref?: string;
}

export function Topbar({ user, mainItems, bottomItems, brand, brandHref }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-6">
      <MobileSidebar
        mainItems={mainItems}
        bottomItems={bottomItems}
        brand={brand}
        brandHref={brandHref}
      />

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openCommandPalette()}
          className="hidden h-8 gap-2 px-3 text-muted-foreground sm:inline-flex"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="text-xs">Search…</span>
          <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-sm">⌘</span>K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openCommandPalette()}
          aria-label="Open command palette"
          className="sm:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
