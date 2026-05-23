import type { Metadata } from 'next';
import { Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Edit workflow' };

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Edit workflow"
        description="In-place editing of an existing workflow lands in Phase 10."
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4 text-muted-foreground">
            <Wand2 className="size-7" aria-hidden />
          </div>
          <h2 className="font-serif text-2xl tracking-tight">Coming in Phase 10</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Full editing of workflow <span className="font-mono">{id.slice(0, 6)}…</span> arrives in
            the next phase. For now, you can pause, activate, or delete from the Settings tab.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
