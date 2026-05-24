import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { listChannels } from '@/lib/integrations/slack';

/**
 * GET /api/integrations/slack/channels?integrationId=<id>
 *
 * Returns `{ channels: [{ id, name, is_private }] }` for the workflow
 * edit-step dialog's channel dropdown. Note: Slack only lists channels
 * the bot is a member of, so private channels missing here mean the bot
 * needs to be invited — same constraint as Zapier.
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
      provider: 'slack',
    })
      .select('_id status')
      .lean();
    if (!doc) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Integration not found.' } },
        { status: 404 },
      );
    }

    const channels = await listChannels(integrationId);
    return NextResponse.json({
      data: {
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          is_private: c.is_private,
        })),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[integrations.slack.channels]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not load channels.' } },
      { status: 500 },
    );
  }
}
