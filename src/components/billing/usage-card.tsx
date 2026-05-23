import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UsageCardProps {
  runsThisPeriod: number;
  runsPerMonth: number;
  overageAllowed: boolean;
  overageRateUsd: number | null;
  periodEnd: Date | null;
}

/**
 * Usage card. The bar transitions to amber at 80% and red once you cross
 * 100%. Overage-enabled plans get a quiet line about the per-run rate;
 * free plans get a "hit your cap" callout instead.
 */
export function UsageCard({
  runsThisPeriod,
  runsPerMonth,
  overageAllowed,
  overageRateUsd,
  periodEnd,
}: UsageCardProps) {
  const pct = runsPerMonth === 0 ? 0 : Math.min(100, (runsThisPeriod / runsPerMonth) * 100);
  const over = runsThisPeriod > runsPerMonth;
  const warn = pct >= 80 && !over;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg tracking-tight">Usage</CardTitle>
        <CardDescription>
          {periodEnd
            ? `Resets on ${periodEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'Resets on the next billing cycle.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-medium tabular-nums">
            {runsThisPeriod.toLocaleString()}
            <span className="text-base text-muted-foreground"> / {runsPerMonth.toLocaleString()} runs</span>
          </p>
          <p className="text-xs text-muted-foreground">{Math.round(pct)}%</p>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'absolute inset-y-0 left-0 transition-all',
              over ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {over && overageAllowed && overageRateUsd ? (
          <p className="text-xs text-muted-foreground">
            You’re past your included quota. Additional runs are billed at $
            {overageRateUsd.toFixed(2)} each on your next invoice.
          </p>
        ) : null}

        {over && !overageAllowed ? (
          <p className="text-xs text-rose-600">
            You’ve used all your runs for this period. Upgrade to keep workflows running.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
