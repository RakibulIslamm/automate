import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Workflows' };

export default function WorkflowsPage() {
  return (
    <>
      <PageHeader
        title="Workflows"
        description="Plain-English automations that AutoMate runs on your schedule."
        action={
          <Button asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Create workflow
            </Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          title="No workflows yet"
          description="Describe an automation in plain English to get started — for example: When I receive a Gmail with 'invoice' in the subject, save the attachment to Drive."
          action={
            <Button asChild>
              <Link href="/dashboard/workflows/new">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Create your first workflow
              </Link>
            </Button>
          }
        />
      </div>
    </>
  );
}
