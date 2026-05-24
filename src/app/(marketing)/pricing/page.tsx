import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSession } from '@/lib/auth/session';
import { PLAN_CONFIG } from '@/lib/stripe/plans';
import type { Plan } from '@/lib/db/models';
import { cn } from '@/lib/utils';
import { FaqSection } from '@/components/marketing/faq-section';

export const metadata = buildMetadata({
  title: 'Pricing · AutoMate',
  description:
    'Free forever. Starter from $19/mo. Pro for teams. Business for unlimited workflows. No contracts, cancel anytime.',
  path: '/pricing',
});

const ORDER: Plan[] = ['free', 'starter', 'pro', 'business'];
const HIGHLIGHT: Plan = 'starter';

// Feature matrix for the comparison table. The rows after the first four
// are static — they describe baseline capabilities every plan gets — so
// they're rendered separately from the run-quota/overage rows that come
// from PLAN_CONFIG.
const FEATURE_MATRIX: Array<{ label: string; values: Record<Plan, string | boolean> }> = [
  {
    label: 'All integrations',
    values: { free: true, starter: true, pro: true, business: true },
  },
  {
    label: 'AI workflow builder',
    values: { free: true, starter: true, pro: true, business: true },
  },
  {
    label: 'Edit AI-generated workflows',
    values: { free: true, starter: true, pro: true, business: true },
  },
  {
    label: 'Scheduled triggers',
    values: { free: true, starter: true, pro: true, business: true },
  },
  {
    label: 'Email triggers',
    values: { free: true, starter: true, pro: true, business: true },
  },
  {
    label: 'Run history',
    values: { free: '7 days', starter: '30 days', pro: '90 days', business: '1 year' },
  },
  {
    label: 'Priority support',
    values: { free: false, starter: true, pro: true, business: true },
  },
  {
    label: 'Roadmap input',
    values: { free: false, starter: false, pro: true, business: true },
  },
  {
    label: 'SSO',
    values: { free: false, starter: false, pro: false, business: true },
  },
  {
    label: 'Dedicated Slack channel',
    values: { free: false, starter: false, pro: false, business: true },
  },
];

export default async function PricingPage() {
  const session = await getSession();
  const isSignedIn = !!session?.user;
  const planCtaHref = (key: Plan) =>
    isSignedIn ? (key === 'free' ? '/dashboard' : '/dashboard/billing') : '/sign-up';
  const planCtaLabel = (key: Plan, name: string) => {
    if (key === 'free') return isSignedIn ? 'Open dashboard' : 'Start free';
    return isSignedIn ? `Upgrade to ${name}` : `Choose ${name}`;
  };

  return (
    <>
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pt-24">
          <h1 className="font-serif text-4xl tracking-tight sm:text-6xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start free with 50 runs. Pay only when you grow past it. No contracts, no surprises, cancel anytime.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ORDER.map((key) => {
              const plan = PLAN_CONFIG[key];
              const highlighted = key === HIGHLIGHT;
              return (
                <div
                  key={key}
                  className={cn(
                    'flex flex-col rounded-2xl border bg-card p-6',
                    highlighted
                      ? 'border-foreground/60 ring-1 ring-foreground/10 shadow-sm'
                      : 'border-border/60',
                  )}
                >
                  <p className="font-serif text-xl tracking-tight">{plan.name}</p>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-medium tabular-nums">
                      ${plan.priceUsd}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.runsPerMonth.toLocaleString()} runs included
                    {plan.overageRateUsd
                      ? ` · then $${plan.overageRateUsd.toFixed(2)}/run`
                      : ''}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Button asChild className="w-full" variant={highlighted ? 'default' : 'outline'}>
                      <Link href={planCtaHref(key)}>{planCtaLabel(key, plan.name)}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
            Compare plans
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Feature</TableHead>
                  {ORDER.map((key) => (
                    <TableHead key={key} className="text-center">
                      {PLAN_CONFIG[key].name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Runs / month</TableCell>
                  {ORDER.map((key) => (
                    <TableCell key={key} className="text-center tabular-nums">
                      {PLAN_CONFIG[key].runsPerMonth.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Overage</TableCell>
                  {ORDER.map((key) => (
                    <TableCell key={key} className="text-center text-sm">
                      {PLAN_CONFIG[key].overageRateUsd
                        ? `$${PLAN_CONFIG[key].overageRateUsd!.toFixed(2)}/run`
                        : '—'}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Max workflows</TableCell>
                  {ORDER.map((key) => (
                    <TableCell key={key} className="text-center text-sm">
                      {PLAN_CONFIG[key].maxWorkflows ?? 'Unlimited'}
                    </TableCell>
                  ))}
                </TableRow>
                {FEATURE_MATRIX.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {ORDER.map((key) => (
                      <TableCell key={key} className="text-center">
                        {typeof row.values[key] === 'boolean' ? (
                          row.values[key] ? (
                            <Check className="mx-auto size-4 text-emerald-600" aria-hidden />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/40" aria-hidden />
                          )
                        ) : (
                          <span className="text-sm">{row.values[key]}</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <FaqSection />

      <section className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            {isSignedIn ? 'Ready when you are' : 'Try it free'}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {isSignedIn
              ? 'Manage your plan from the dashboard. Switch or cancel any time.'
              : '50 runs, every integration, the AI builder. No card required to start.'}
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href={isSignedIn ? '/dashboard/billing' : '/sign-up'}>
                {isSignedIn ? 'Manage plan' : 'Create your account'}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
