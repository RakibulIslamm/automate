import type { Metadata } from 'next';
import { format } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PortalButton } from '@/components/billing/portal-button';
import { PlanCard } from '@/components/billing/plan-card';
import { UsageCard } from '@/components/billing/usage-card';
import { UpgradeModal } from '@/components/billing/upgrade-modal';
import { requireUser } from '@/lib/auth/guards';
import { PLAN_CONFIG, getPlan } from '@/lib/stripe/plans';
import { stripe } from '@/lib/stripe/client';
import type { Plan } from '@/lib/db/models';

export const metadata: Metadata = { title: 'Billing' };

interface InvoiceRow {
  id: string;
  number: string | null;
  amountUsd: number;
  status: string;
  createdAt: Date;
  hostedUrl: string | null;
}

export default async function BillingPage() {
  const user = await requireUser();
  const currentPlan: Plan = user.plan ?? 'free';
  const plan = getPlan(currentPlan);
  const runsThisPeriod = user.usage?.runsThisPeriod ?? 0;
  const periodEnd = user.usage?.periodEnd ? new Date(user.usage.periodEnd) : null;
  const hasSubscription = Boolean(user.stripeSubscriptionId);

  // Fetch recent invoices best-effort — if Stripe is down the page still
  // renders, the table just shows the empty state.
  let invoices: InvoiceRow[] = [];
  if (user.stripeCustomerId) {
    try {
      const list = await stripe().invoices.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });
      invoices = list.data.map((i) => ({
        id: i.id ?? '',
        number: i.number ?? null,
        amountUsd: (i.amount_paid ?? i.amount_due ?? 0) / 100,
        status: i.status ?? 'unknown',
        createdAt: new Date((i.created ?? 0) * 1000),
        hostedUrl: i.hosted_invoice_url ?? null,
      }));
    } catch {
      // best-effort
    }
  }

  return (
    <>
      <UpgradeModal currentPlan={currentPlan} />
      <PageHeader
        eyebrow="Account"
        title="Billing"
        description="Manage your plan, see how much you've run, and grab invoices."
        action={hasSubscription ? <PortalButton /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg tracking-tight">Current plan</CardTitle>
            <CardDescription>
              {plan.priceUsd === 0
                ? 'Free plan — no card needed.'
                : `$${plan.priceUsd} / month`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Plan:</span>{' '}
              <span className="font-medium">{plan.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Runs included:</span>{' '}
              <span className="tabular-nums">{plan.runsPerMonth.toLocaleString()} / month</span>
            </p>
            {plan.overageRateUsd !== null ? (
              <p>
                <span className="text-muted-foreground">Overage:</span>{' '}
                <span className="tabular-nums">${plan.overageRateUsd.toFixed(2)} / run</span>
              </p>
            ) : null}
            {periodEnd ? (
              <p>
                <span className="text-muted-foreground">Next reset:</span>{' '}
                {format(periodEnd, 'PP')}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <UsageCard
          runsThisPeriod={runsThisPeriod}
          runsPerMonth={plan.runsPerMonth}
          overageAllowed={plan.overageRateUsd !== null}
          overageRateUsd={plan.overageRateUsd}
          periodEnd={periodEnd}
        />
      </div>

      <section className="mt-8 space-y-3">
        <div>
          <h2 className="font-serif text-xl tracking-tight">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade or switch any time. We bill monthly through Stripe.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['free', 'starter', 'pro', 'business'] as Plan[]).map((key) => (
            <PlanCard
              key={key}
              planKey={key}
              plan={PLAN_CONFIG[key]}
              isCurrent={currentPlan === key}
              hasSubscription={hasSubscription}
            />
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div>
          <h2 className="font-serif text-xl tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Your most recent ten invoices.</p>
        </div>
        <Card>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Invoices show up here once you’re on a paid plan.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.number ?? '—'}</TableCell>
                      <TableCell>{format(inv.createdAt, 'PP')}</TableCell>
                      <TableCell className="tabular-nums">${inv.amountUsd.toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{inv.status}</TableCell>
                      <TableCell className="text-right">
                        {inv.hostedUrl ? (
                          <a
                            href={inv.hostedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
