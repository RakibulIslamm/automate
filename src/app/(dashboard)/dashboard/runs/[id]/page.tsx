import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/states/empty-state';

export const metadata: Metadata = { title: 'Run' };

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Run"
        description={`Detail view placeholder for run ${id.slice(0, 6)}…`}
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          title="Run timeline coming soon"
          description="Step-by-step inputs, outputs and errors land alongside the executor in Phase 8."
        />
      </div>
    </>
  );
}
