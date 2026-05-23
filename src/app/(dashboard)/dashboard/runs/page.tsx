import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Runs' };

export default function RunsPage() {
  return (
    <>
      <PageHeader
        title="Runs"
        description="Every workflow execution, with step-by-step output and timing."
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          icon={<History className="h-8 w-8" aria-hidden />}
          title="No runs yet"
          description="Once you create and trigger a workflow, its runs show up here."
        />
      </div>
    </>
  );
}
