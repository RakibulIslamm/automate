import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PLAN_CONFIG } from '@/lib/stripe/plans';
import type { Plan } from '@/lib/db/models';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const plan = PLAN_CONFIG[(user.plan ?? 'free') as Plan];
  const byokEnabled = env.BYOK_ENABLE;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, plan, and account-level controls."
      />

      <div className="space-y-10">
        {/* Profile row */}
        <section>
          <SectionHeader title="Profile" />
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar className="size-16">
                {user.image ? <AvatarImage src={user.image} alt={user.name ?? 'avatar'} /> : null}
                <AvatarFallback className="font-serif text-xl">{initials || '?'}</AvatarFallback>
              </Avatar>
              <dl className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Name" value={user.name ?? '—'} />
                <Field label="Email" value={user.email} />
                <Field label="Role" value={user.isAdmin ? 'Admin' : 'Member'} />
              </dl>
            </div>
          </div>
        </section>

        {/* Plan row */}
        <section>
          <SectionHeader
            title="Plan"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/billing">Manage billing</Link>
              </Button>
            }
          />
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Current plan
              </p>
              <p className="font-serif text-3xl tracking-tight">{plan.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.runsPerMonth.toLocaleString()} runs / month included
                {plan.overageRateUsd
                  ? ` · then $${plan.overageRateUsd.toFixed(2)} per additional run`
                  : ''}
              </p>
            </div>
          </div>
        </section>

        {/* BYOK — only when demo mode is enabled, just a pointer to the dedicated page */}
        {/* {byokEnabled ? (
          <section>
            <SectionHeader
              title="Demo keys"
              action={
                <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  BYOK · demo mode
                </span>
              }
            />
            <Link
              href="/dashboard/byok"
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-foreground/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                  <KeyRound className="size-4" aria-hidden />
                </div>
                <div>
                  <p className="font-medium">Manage your AI provider key</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This portfolio runs AI on visitor-supplied keys — add yours so the AI features
                    work without burning the project owner's credits.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <span className="transition-transform group-hover:translate-x-0.5">Open BYOK →</span>
              </Button>
            </Link>
          </section>
        ) : null} */}

        {/* Session row */}
        <section>
          <SectionHeader title="Session" />
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Sign out of AutoMate</p>
                <p className="text-xs text-muted-foreground">
                  You'll need to sign in again to access the dashboard.
                </p>
              </div>
              <form action="/api/auth/signout" method="post">
                <Button type="submit" variant="outline" size="sm">
                  <LogOut className="size-3.5" aria-hidden />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-sm">{value}</dd>
    </div>
  );
}
