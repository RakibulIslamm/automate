import { NextResponse } from 'next/server';
import { safeRoute } from '@/lib/safe-route';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/db/models';

/**
 * Liveness + DB connectivity probe. Pings MongoDB with a cheap count and
 * returns the connection state. Used to verify Phase 3 wiring; will become
 * the uptime monitor target later.
 */
export const GET = safeRoute({
  handler: async () => {
    await connectDb();
    await User.estimatedDocumentCount();
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  },
});
