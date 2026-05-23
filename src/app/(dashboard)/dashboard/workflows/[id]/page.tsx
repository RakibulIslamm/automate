import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/states/empty-state';

export const metadata: Metadata = { title: 'Workflow' };

interface WorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Workflow"
        description={`Detail view placeholder for workflow ${id.slice(0, 6)}…`}
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          title="Workflow detail coming soon"
          description="Definition viewer, edit controls and recent runs land in Phase 9."
        />
      </div>
    </>
  );
}
