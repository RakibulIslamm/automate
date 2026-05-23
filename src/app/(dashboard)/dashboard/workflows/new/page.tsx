import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { WorkflowBuilder } from '@/components/workflows/workflow-builder';

export const metadata: Metadata = { title: 'Create workflow' };

export default function NewWorkflowPage() {
  return (
    <>
      <PageHeader
        title="Create workflow"
        description="Describe what you want to automate in plain English — AutoMate builds it for you."
      />
      <WorkflowBuilder />
    </>
  );
}
