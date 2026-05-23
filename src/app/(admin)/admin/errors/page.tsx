import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { connectDb } from '@/lib/db/connect';
import { ErrorLog, ERROR_SEVERITIES, type ErrorSeverity } from '@/lib/db/models';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Admin · Errors' };

interface ErrorsPageProps {
  searchParams: Promise<{ severity?: string }>;
}

const SEVERITY_BADGE: Record<ErrorSeverity, string> = {
  low: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  critical: 'bg-destructive/15 text-destructive',
};

function isValidSeverity(s: string | undefined): s is ErrorSeverity {
  return !!s && (ERROR_SEVERITIES as readonly string[]).includes(s);
}

export default async function AdminErrorsPage({ searchParams }: ErrorsPageProps) {
  const { severity } = await searchParams;
  const filter = isValidSeverity(severity) ? severity : undefined;

  await connectDb();
  const rows = await ErrorLog.find(filter ? { severity: filter } : {})
    .sort({ occurredAt: -1 })
    .limit(100)
    .lean();

  return (
    <>
      <PageHeader
        title="Errors"
        description="Self-hosted error log — auto-deleted after 30 days. Latest 100 entries shown."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill href="/admin/errors" active={!filter} label="All" />
        {ERROR_SEVERITIES.map((s) => (
          <FilterPill
            key={s}
            href={`/admin/errors?severity=${s}`}
            active={filter === s}
            label={s}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState title="No errors" description="Either nothing has broken, or your filter is too tight." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead className="w-44">Name / code</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-40">Source</TableHead>
                <TableHead className="w-32 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const ctx = (row.context ?? {}) as Record<string, unknown>;
                const source = typeof ctx.source === 'string' ? ctx.source : '—';
                const url = typeof ctx.url === 'string' ? ctx.url : undefined;
                const sev = (row.severity ?? 'medium') as ErrorSeverity;
                return (
                  <TableRow key={String(row._id)}>
                    <TableCell>
                      <Badge variant="secondary" className={cn('font-mono uppercase', SEVERITY_BADGE[sev])}>
                        {sev}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs">{row.name ?? 'Error'}</p>
                      {row.code ? (
                        <p className="text-xs text-muted-foreground">{row.code}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm">{row.message}</p>
                      {url ? <p className="truncate text-xs text-muted-foreground">{url}</p> : null}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{source}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {row.occurredAt
                        ? formatDistanceToNow(new Date(row.occurredAt), { addSuffix: true })
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
