import Link from 'next/link';
import { SidebarNav } from './sidebar-nav';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck } from 'lucide-react';
import type { NavItem } from './nav-config';
import { cn } from '@/lib/utils';

export interface SidebarProps {
  mainItems: NavItem[];
  bottomItems: NavItem[];
  brand?: 'AutoMate' | 'Admin';
  brandHref?: string;
  className?: string;
  /** Called when a nav item is clicked — used by the mobile sheet to auto-close. */
  onNavigate?: () => void;
}

/**
 * The shared sidebar body. Composed into either a fixed desktop panel or a
 * mobile <Sheet> via [`MobileSidebar`](./mobile-sidebar.tsx).
 */
export function SidebarBody({
  mainItems,
  bottomItems,
  brand = 'AutoMate',
  brandHref = '/dashboard',
  className,
  onNavigate,
}: SidebarProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <Link
        href={brandHref}
        onClick={onNavigate}
        className="flex items-center gap-2 px-4 py-4 text-foreground"
      >
        {brand === 'Admin' ? (
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" aria-hidden />
            <span className="font-serif text-2xl tracking-tight">Admin</span>
          </span>
        ) : (
          <span className="font-serif text-2xl tracking-tight">AutoMate</span>
        )}
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav items={mainItems} onNavigate={onNavigate} />
      </div>

      {bottomItems.length > 0 ? (
        <>
          <Separator />
          <div className="px-3 py-4">
            <SidebarNav items={bottomItems} onNavigate={onNavigate} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Desktop fixed sidebar. Hidden below the lg breakpoint — see
 * [`MobileSidebar`](./mobile-sidebar.tsx) for the mobile counterpart.
 */
export function DesktopSidebar(props: SidebarProps) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-background">
      <SidebarBody {...props} />
    </aside>
  );
}
