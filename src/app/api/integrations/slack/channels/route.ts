import { NextResponse, type NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireUser } from '@/lib/auth/guards';
import { connectDb } from '@/lib/db/connect';
import { Integration } from '@/lib/db/models';
import { listChannels, authTest } from '@/lib/integrations/slack';

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

    const [channels, bot] = await Promise.all([
      listChannels(integrationId),
      authTest(integrationId).catch(() => null),
    ]);

    const botHandle = bot?.user ? `@${bot.user}` : '@AutoMate';

    return NextResponse.json({
      data: {
        bot: bot ? { name: bot.user, team: bot.team } : null,
        channels: channels.map((c) => {
          // Public channels: post will auto-join if the bot has channels:join.
          // Private channels missing membership: must be invited manually —
          // Slack does not allow bots to self-join private channels.
          const needsInvite = c.is_private && !c.is_member;
          return {
            id: c.id,
            name: c.name,
            is_private: c.is_private,
            is_member: c.is_member,
            warning: needsInvite
              ? `The bot isn't in this channel. Run /invite ${botHandle} inside #${c.name} once, then it can post.`
              : undefined,
          };
        }),
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
