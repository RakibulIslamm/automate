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
     * Populate the JWT with our app fields. `user` is only present on the
     * initial sign-in callback; subsequent requests just pass the existing
     * token through.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          await connectDb();
          const dbUser = await User.findOne({ email: user.email.toLowerCase() })
            .select('_id plan isAdmin')
            .lean<{ _id: unknown; plan?: Plan; isAdmin?: boolean }>();
          if (dbUser) {
            token.id = String(dbUser._id);
            if (dbUser.plan) token.plan = dbUser.plan;
            if (typeof dbUser.isAdmin === 'boolean') token.isAdmin = dbUser.isAdmin;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[auth.jwt] failed to enrich token', err);
        }
      }
      return token;
    },

    /**
     * Project the token's app fields onto `session.user` so server components
     * and client `useSession()` see them.
     */
    session({ session, token }) {
      if (session.user && token) {
        if (typeof token.id === 'string') session.user.id = token.id;
        // JWT extends Record<string, unknown> so augmented fields read as unknown.
        if (token.plan) session.user.plan = token.plan as Plan;
        if (typeof token.isAdmin === 'boolean') session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
});
