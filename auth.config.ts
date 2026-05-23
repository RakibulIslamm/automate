import { NextResponse } from 'next/server';
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
const AUTH_PAGES = new Set(['/sign-in', '/sign-up']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Resolve `?callbackUrl=…` for signed-in users bouncing off /sign-in. We only
 * honour same-origin destinations to avoid open redirects via crafted links.
 */
function safeCallback(url: URL, fallback: string): string {
  const raw = url.searchParams.get('callbackUrl');
  if (!raw) return fallback;
  try {
    const target = new URL(raw, url.origin);
    if (target.origin === url.origin) return target.pathname + target.search + target.hash;
  } catch {
    // ignore malformed input
  }
  return fallback;
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
    // Auth.js appends `?error=<code>` to this path. Don't put query strings in
    // these values — Auth.js's URL builder is naive about existing `?`, which
    // produces malformed `?status=x?error=y` URLs whose error param is then
    // unreadable by the client-side signIn() helper.
    error: '/sign-in',
    // We intentionally don't override verifyRequest. With `redirect: false`
    // from the client form, the form renders its own "check your email" UI
    // anyway, so the verifyRequest page never shows.
  },
  session: { strategy: 'jwt' },
  callbacks: {
    /**
     * Project our custom JWT fields (`id`, `plan`, `isAdmin`) onto
     * `session.user` so they're visible in BOTH the Edge proxy and Node
     * server code. Without this callback the proxy sees `session.user`
     * with only the default OIDC fields (name, email, image), so the
     * `isAdmin` check below is silently always false.
     */
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === 'string') session.user.id = token.id;
        if (typeof token.plan === 'string') {
          session.user.plan = token.plan as typeof session.user.plan;
        }
        if (typeof token.isAdmin === 'boolean') session.user.isAdmin = token.isAdmin;
      }
      return session;
    },

    authorized({ auth, request }) {
      const url = request.nextUrl;
      const pathname = url.pathname;
      const isLoggedIn = !!auth?.user;
      const isAdmin = auth?.user?.isAdmin === true;

      // Bounce signed-in users out of the auth pages — they don't need to
      // sign in again. Honor `?callbackUrl=` when it's same-origin.
      if (isLoggedIn && AUTH_PAGES.has(pathname)) {
        return NextResponse.redirect(new URL(safeCallback(url, '/dashboard'), url.origin));
      }

      if (isPublicPath(pathname)) return true;

      if (pathname.startsWith('/admin')) {
        if (!isLoggedIn) return false; // → /sign-in?callbackUrl=/admin/...
        if (!isAdmin) {
          // Signed in but not an admin — send to /dashboard instead of
          // /sign-in. Returning false here would loop a callbackUrl back to
          // /admin → /sign-in → /admin forever.
          return NextResponse.redirect(new URL('/dashboard', url.origin));
        }
        return true;
      }

      // Default: protected. Return false → middleware redirects to signIn page.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
