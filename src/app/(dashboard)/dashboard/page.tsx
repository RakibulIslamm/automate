import type { Metadata } from 'next';
import { Activity, Gauge, Sparkles, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/states/empty-state';

export const metadata: Metadata = { title: 'Overview' };

const STATS = [
  { label: 'Active workflows', icon: Sparkles },
  { label: 'Runs this month', icon: Activity },
  { label: 'Success rate', icon: TrendingUp },
  { label: 'Plan usage', icon: Gauge },
] as const;

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Status at a glance. Real numbers light up once your first workflow runs."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-32" />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight">Recent activity</h2>
        <div className="mt-4 rounded-lg border border-dashed border-border">
          <EmptyState
            title="No activity yet"
            description="Once a workflow runs, its events land here in real time."
          />
        </div>
      </section>
    </>
  );
}
