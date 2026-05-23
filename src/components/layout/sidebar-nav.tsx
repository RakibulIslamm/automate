'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-config';

interface SidebarNavProps {
  items: NavItem[];
  onNavigate?: () => void;
}

export function SidebarNav({ items, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive =
          item.href === pathname ||
          (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group inline-flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
              )}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
