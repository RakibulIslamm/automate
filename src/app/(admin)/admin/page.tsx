import type { Metadata } from 'next';
import { connectDb } from '@/lib/db/connect';
import { ErrorLog, EventLog, User, Workflow, WorkflowRun } from '@/lib/db/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Admin · Overview' };

async function getCounts() {
  await connectDb();
  const [users, workflows, runs, errors, events] = await Promise.all([
    User.estimatedDocumentCount(),
    Workflow.estimatedDocumentCount(),
    WorkflowRun.estimatedDocumentCount(),
    ErrorLog.estimatedDocumentCount(),
    EventLog.estimatedDocumentCount(),
  ]);
  return { users, workflows, runs, errors, events };
}

export default async function AdminOverviewPage() {
  const counts = await getCounts();
  const stats: Array<{ label: string; value: number }> = [
    { label: 'Users', value: counts.users },
    { label: 'Workflows', value: counts.workflows },
    { label: 'Runs', value: counts.runs },
    { label: 'Errors (30d)', value: counts.errors },
    { label: 'Events (30d)', value: counts.events },
  ];

  return (
    <>
      <PageHeader
        title="Admin"
        description="High-level system health. Errors and events are auto-pruned after 30 days."
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-3xl tracking-tight">{stat.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
