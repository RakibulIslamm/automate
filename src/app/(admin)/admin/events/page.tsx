import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { connectDb } from '@/lib/db/connect';
import { EventLog } from '@/lib/db/models';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Admin · Events' };

export default async function AdminEventsPage() {
  await connectDb();
  const rows = await EventLog.find({}).sort({ occurredAt: -1 }).limit(100).lean();

  return (
    <>
      <PageHeader
        title="Events"
        description="Product-event log — auto-deleted after 30 days. Latest 100 entries shown."
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            title="No events yet"
            description="Once trackEvent() fires anywhere in the app, entries land here."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Event</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead className="w-40">User</TableHead>
                <TableHead className="w-32 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const properties = row.properties ? JSON.stringify(row.properties) : '—';
                return (
                  <TableRow key={String(row._id)}>
                    <TableCell className="font-mono text-xs">{row.name}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate font-mono text-xs text-muted-foreground">{properties}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.userId ? String(row.userId).slice(-6) : '—'}
                      </span>
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
