'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGMENT_LABEL_OVERRIDES: Record<string, string> = {
  dashboard: 'Dashboard',
  workflows: 'Workflows',
  runs: 'Runs',
  integrations: 'Integrations',
  billing: 'Billing',
  settings: 'Settings',
  account: 'Account',
  notifications: 'Notifications',
  admin: 'Admin',
  errors: 'Errors',
  events: 'Events',
  users: 'Users',
  new: 'New',
};

function humanize(segment: string): string {
  if (SEGMENT_LABEL_OVERRIDES[segment]) return SEGMENT_LABEL_OVERRIDES[segment];
  // Looks like a Mongo ObjectId — show a truncated identifier
  if (/^[a-f0-9]{24}$/i.test(segment)) return segment.slice(0, 6) + '…';
  return segment;
}

export interface BreadcrumbOverride {
  segment: string;
  label: string;
}

export interface BreadcrumbsProps {
  className?: string;
  overrides?: BreadcrumbOverride[];
}

export function Breadcrumbs({ className, overrides = [] }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const overrideMap = new Map(overrides.map((o) => [o.segment, o.label]));

  return (
    <nav aria-label="Breadcrumb" className={cn('flex min-w-0 items-center text-sm', className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        {segments.map((seg, idx) => {
          const href = '/' + segments.slice(0, idx + 1).join('/');
          const label = overrideMap.get(seg) ?? humanize(seg);
          const isLast = idx === segments.length - 1;
          return (
            <Fragment key={href}>
              {idx > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
