import { requireUserOrRedirect } from '@/lib/auth/guards';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { UpgradeModal } from '@/components/billing/upgrade-modal';
import { connectDb } from '@/lib/db/connect';
import { ByokKey, type Plan } from '@/lib/db/models';
import { env } from '@/lib/env';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect('/dashboard');

  // In BYOK demo mode, light up the nav item in red until the user has saved
  // at least an AI key. Skip the DB hit entirely when not in demo mode.
  let byokNeedsAttention = false;
  if (env.BYOK_ENABLE) {
    await connectDb();
    const aiKeyCount = await ByokKey.countDocuments({
      userId: user._id,
      provider: { $in: ['openai', 'anthropic', 'openrouter', 'deepseek'] },
    });
    byokNeedsAttention = aiKeyCount === 0;
  }

  return (
    <DashboardShell
      user={{
        name: user.name ?? undefined,
        email: user.email,
        image: user.image ?? undefined,
      }}
      isAdmin={!!user.isAdmin}
      byokEnabled={env.BYOK_ENABLE}
      byokNeedsAttention={byokNeedsAttention}
    >
      {/* Global upgrade modal — listens for the `automate:show-upgrade-modal`
          event from anywhere in the dashboard (run-now-button on quota toast,
          etc). The billing page mounts its own copy too. */}
      <UpgradeModal currentPlan={(user.plan as Plan) ?? 'free'} />
      {children}
    </DashboardShell>
  );
}
