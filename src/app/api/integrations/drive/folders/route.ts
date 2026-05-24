import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { listFolders } from '@/lib/integrations/drive';

/**
 * GET /api/integrations/drive/folders?integrationId=<id>
 *
 * Returns `{ folders: [{ id, name }] }` for the workflow edit-step
 * dialog's folder dropdown. Google's OAuth scope already restricts what
 * the integration can see — we still verify ownership here so an
 * attacker can't enumerate other users' integrations.
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
      provider: 'google',
    })
      .select('_id status')
      .lean();
    if (!doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Integration not found.' } },
        { status: 404 },
      );
    }

    const folders = await listFolders(integrationId);
    return NextResponse.json({ data: { folders } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[integrations.drive.folders]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not load folders.' } },
      { status: 500 },
    );
  }
}
