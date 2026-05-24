import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Workflow } from '@/lib/db/models';
import { workflowDefinitionSchema } from '@/lib/workflows/dsl';

export const metadata: Metadata = { title: 'Edit workflow' };

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  const user = await requireUser();
  await connectDb();
  const doc = await Workflow.findOne({
    _id: new Types.ObjectId(id),
    userId: user._id,
  }).lean();
  if (!doc) notFound();

  // Defense in depth: the stored definition is `Mixed`, so we can't trust
  // the shape across a schema migration. If it doesn't parse, show a
  // friendly explainer instead of crashing the editor.
  const parsed = workflowDefinitionSchema.safeParse(doc.definition);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      '[workflow-edit] definition failed schema re-parse',
      JSON.stringify(
        {
          workflowId: String(doc._id),
          issues: parsed.error.issues,
          storedDefinition: doc.definition,
        },
        null,
        2,
      ),
    );
    return (
      <>
        <PageHeader
          eyebrow="Edit"
          title={doc.name}
          description="Stored definition no longer matches the schema."
        />
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-medium">This workflow can't be edited right now.</p>
            <p className="text-sm text-muted-foreground">
              The schema has changed since this workflow was saved. Re-create it from
              the builder to fix.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Edit workflow"
        title={doc.name}
        description="Tweak the name, schedule, or individual steps. Changes save into the existing workflow."
      />
      <WorkflowEditor
        workflowId={String(doc._id)}
        initialName={doc.name}
        initialDescription={doc.description ?? ''}
        initialDefinition={parsed.data}
        originalPrompt={doc.originalPrompt ?? null}
      />
    </>
  );
}
