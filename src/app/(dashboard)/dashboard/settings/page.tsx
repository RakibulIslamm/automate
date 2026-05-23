import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already guarded; satisfies TS

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account info from your profile. Editable fields land in Phase 10."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? 'avatar'} /> : null}
            <AvatarFallback className="text-base">{initials || '?'}</AvatarFallback>
          </Avatar>
          <dl className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" value={user.name ?? '—'} />
            <Field label="Email" value={user.email} />
            <Field
              label="Plan"
              value={
                <Badge variant="secondary" className="font-mono uppercase">
                  {user.plan ?? 'free'}
                </Badge>
              }
            />
            <Field label="Role" value={user.isAdmin ? 'Admin' : 'Member'} />
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
