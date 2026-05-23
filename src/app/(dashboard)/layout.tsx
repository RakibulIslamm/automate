import { requireUserOrRedirect } from '@/lib/auth/guards';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect('/dashboard');

  return (
    <DashboardShell
      user={{
        name: user.name ?? undefined,
        email: user.email,
        image: user.image ?? undefined,
      }}
      isAdmin={!!user.isAdmin}
    >
      {children}
    </DashboardShell>
  );
}
