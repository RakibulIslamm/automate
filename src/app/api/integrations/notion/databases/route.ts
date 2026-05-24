import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { listDatabases } from '@/lib/integrations/notion';

/**
 * GET /api/integrations/notion/databases?integrationId=<id>
 *
 * Returns `{ databases: [{ id, title }] }` for the workflow edit-step
 * dialog's database dropdown. Verifies ownership before hitting Notion —
 * an attacker can't enumerate another user's integration by guessing ids.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const integrationId = req.nextUrl.searchParams.get('integrationId');
    if (!integrationId || !Types.ObjectId.isValid(integrationId)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'integrationId is required.' } },
        { status: 400 },
      );
    }

    await connectDb();
    const doc = await Integration.findOne({
      _id: new Types.ObjectId(integrationId),
      userId: user._id,
      provider: 'notion',
    })
      .select('_id status')
      .lean();
    if (!doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Integration not found.' } },
        { status: 404 },
      );
    }

    const databases = await listDatabases(integrationId);
    return NextResponse.json({ data: { databases } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[integrations.notion.databases]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not load databases.' } },
      { status: 500 },
    );
  }
}
