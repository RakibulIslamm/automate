import { requireAdmin } from '@/lib/auth/guards';
import { AdminShell } from '@/components/layout/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware also gates /admin/* — this is defence-in-depth and gives us
  // a typed `user` doc to read from.
  const user = await requireAdmin();

  return (
    <AdminShell
      user={{
        name: user.name ?? undefined,
        email: user.email,
        image: user.image ?? undefined,
      }}
    >
      {children}
    </AdminShell>
  );
}
