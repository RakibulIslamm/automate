import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { WorkflowRun } from '@/lib/db/models';

/**
 * GET /api/runs/[id] — minimal poll endpoint backing the live updates
 * hook on the run detail page. Returns the run shape the page already
 * understands, so the client can drop it straight into state.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run not found.' } },
        { status: 404 },
      );
    }

    await connectDb();
    const run = await WorkflowRun.findOne({
      _id: new Types.ObjectId(id),
      userId: user._id,
    }).lean();
    if (!run) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run not found.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        id: String(run._id),
        status: run.status,
        startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        durationMs: typeof run.durationMs === 'number' ? run.durationMs : null,
        costUsd: typeof run.costUsd === 'number' ? run.costUsd : null,
        stepResults: run.stepResults ?? [],
        errorMessage: run.errorMessage ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not load run.' } },
      { status: 500 },
    );
  }
}
