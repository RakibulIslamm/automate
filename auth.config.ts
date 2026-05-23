import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe Auth.js config. Imported by middleware (Edge runtime) — must NOT
 * pull in Node-only modules like Mongoose, mongodb, fs, etc. Heavy callbacks
 * (signIn that writes to the DB, jwt that reads user defaults) live in the
 * full `auth.ts` instead.
 *
 * The `authorized` callback runs on every middleware-protected request and
 * decides whether the user can access the path.
 */

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up', '/pricing'];
const PUBLIC_PREFIXES = ['/legal/', '/api/auth/'];
const PUBLIC_EXACT = new Set(['/api/internal/health']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default {
  // Email/Resend provider lives in the full `auth.ts` because it requires
  // a database adapter that can't run on the edge.
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { scope: 'openid email profile' } },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/sign-in',
    verifyRequest: '/sign-in?status=check-email',
    error: '/sign-in?status=error',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;

      const isLoggedIn = !!auth?.user;

      if (pathname.startsWith('/admin')) {
        return isLoggedIn && auth?.user?.isAdmin === true;
      }

      // Default: protected. Return false → middleware redirects to signIn page.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
