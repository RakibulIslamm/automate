import { requireUserOrRedirect } from '@/lib/auth/guards';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { UpgradeModal } from '@/components/billing/upgrade-modal';
import type { Plan } from '@/lib/db/models';

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
      {/* Global upgrade modal — listens for the `automate:show-upgrade-modal`
          event from anywhere in the dashboard (run-now-button on quota toast,
          etc). The billing page mounts its own copy too. */}
      <UpgradeModal currentPlan={(user.plan as Plan) ?? 'free'} />
      {children}
    </DashboardShell>
  );
}
