import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Create workflow' };

export default function NewWorkflowPage() {
  return (
    <>
      <PageHeader
        title="Create workflow"
        description="Describe what you want to automate in plain English — AutoMate builds it for you."
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4 text-muted-foreground">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="font-serif text-2xl tracking-tight">AI builder coming in Phase 9</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            The natural-language workflow builder lands in Phase 9. For now this is a placeholder so
            the route works.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
