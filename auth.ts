import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import authConfig from './auth.config';
import clientPromise from '@/lib/auth/mongodb-client';
import { connectDb } from '@/lib/db/connect';
import { User, type Plan } from '@/lib/db/models';

/**
 * Full Auth.js v5 config. Used by API routes and server components —
 * adds the MongoDB adapter and the DB-touching callbacks (signIn/jwt/session)
 * on top of the Edge-safe `auth.config.ts`.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.RESEND_FROM_EMAIL,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Runs once per sign-in. The adapter has already created (or found) the
     * user doc with `{name, email, image, emailVerified}`. We layer on our
     * app-specific defaults (plan, isAdmin, usage) without overwriting any
     * values that already exist — this is idempotent across re-sign-ins.
     */
    async signIn({ user }) {
      if (!user?.email) return false;

      try {
        await connectDb();
        await User.updateOne(
          { email: user.email.toLowerCase() },
          [
            {
              $set: {
                plan: { $ifNull: ['$plan', 'free'] },
                isAdmin: { $ifNull: ['$isAdmin', false] },
                'usage.runsThisPeriod': { $ifNull: ['$usage.runsThisPeriod', 0] },
              },
            },
          ],
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth.signIn] failed to apply user defaults', err);
        // Don't block sign-in if the enrichment fails — Auth.js still has a valid user.
      }
      return true;
    },

    /**
     * Refresh the JWT from the DB on every call. `user` is present only on
     * the initial sign-in; on subsequent calls we still re-fetch using
     * `token.email` so role/plan changes (e.g., flipping `isAdmin: true` in
     * Atlas) propagate without forcing the user to sign out and back in.
     *
     * Cost: one indexed Mongo read per server-side auth() call (one per
     * server-rendered page). Acceptable for correctness; we can add a TTL
     * cache later if it shows up in profiles.
     */
    async jwt({ token, user, trigger }) {
      const email =
        user?.email ?? (typeof token.email === 'string' ? token.email : undefined);
      if (!email) return token;

      // Always refresh on sign-in / explicit update; otherwise refresh too
      // (cheap, and the alternative is a 30-day stale token).
      try {
        await connectDb();
        const dbUser = await User.findOne({ email: email.toLowerCase() })
          .select('_id plan isAdmin')
          .lean<{ _id: unknown; plan?: Plan; isAdmin?: boolean }>();
        if (dbUser) {
          token.id = String(dbUser._id);
          token.plan = dbUser.plan ?? 'free';
          token.isAdmin = !!dbUser.isAdmin;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth.jwt] failed to refresh token from DB', { trigger, err });
        // Don't blow up the request — fall through with whatever's already in token.
      }
      return token;
    },

    // session callback is shared from `auth.config.ts` via `...authConfig.callbacks`.
    // Keeping the projection in one place means the Edge proxy and Node code
    // see the exact same `session.user` shape.
  },
});
