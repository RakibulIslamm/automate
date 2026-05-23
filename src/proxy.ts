import NextAuth from 'next-auth';
import authConfig from '../auth.config';

/**
 * Edge-runtime proxy (the Next.js 16 successor to `middleware.ts`). Uses the
 * slim `auth.config.ts` (no DB imports) so it can run on the edge without a
 * Node-only runtime. The `authorized` callback in auth.config decides public
 * vs. protected for each path; when it returns false, Auth.js auto-redirects
 * to the configured sign-in page with `callbackUrl` preserved.
 *
 * Note: we export `proxy` explicitly (rather than destructuring as
 * `{ auth: proxy } = NextAuth(...)`) because Turbopack's static analyzer
 * doesn't always recognise the renamed destructure as a `proxy` export.
 */
const { auth } = NextAuth(authConfig);
export const proxy = auth;

export const config = {
  matcher: [
    // Run on everything except Next internals, static files, and well-known
    // public assets. Auth.js's `authorized` callback handles the actual
    // public/protected decision per path.
    '/((?!_next/static|_next/image|_next/data|favicon.ico|next.svg|vercel.svg|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff2?|ttf|otf)$).*)',
  ],
};
