import type { Metadata } from 'next';
import { format } from 'date-fns';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Admin · Users' };

function initialsOf(name?: string | null, email?: string | null): string {
  return (name ?? email ?? '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function AdminUsersPage() {
  await connectDb();
  const rows = await User.find({}).sort({ createdAt: -1 }).limit(100).lean();

  return (
    <>
      <PageHeader
        title="Users"
        description="Latest 100 user accounts. Sorted newest first."
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            title="No users yet"
            description="Once anyone signs in via Auth.js, their account appears here."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-32">Plan</TableHead>
                <TableHead className="w-24">Role</TableHead>
                <TableHead className="w-40 text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row._id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {row.image ? <AvatarImage src={row.image} alt={row.name ?? ''} /> : null}
                        <AvatarFallback className="text-xs">
                          {initialsOf(row.name, row.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name ?? '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono uppercase">
                      {row.plan ?? 'free'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.isAdmin ? (
                      <Badge variant="default">Admin</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Member</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.createdAt ? format(new Date(row.createdAt), 'd MMM yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
