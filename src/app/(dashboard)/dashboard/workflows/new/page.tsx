import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { WorkflowBuilder } from '@/components/workflows/workflow-builder';

export const metadata: Metadata = { title: 'Create workflow' };

export default function NewWorkflowPage() {
  return (
    <>
      <PageHeader
        eyebrow="New"
        title="Describe your workflow"
        description="In plain English — what should AutoMate do for you? The AI builds the structure; you review and run."
      />
      <WorkflowBuilder />
    </>
  );
}
