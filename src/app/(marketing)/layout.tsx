import { getSession } from '@/lib/auth/session';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

/**
 * Public-facing layout — wraps the landing page, pricing, and legal
 * routes with the shared nav + footer. Kept intentionally minimal: no
 * dashboard chrome, no auth guard. The root layout handles fonts and
 * the theme provider.
 *
 * We do one cheap JWT decode here so the nav can swap "Sign in /
 * Start free" for "Open dashboard" when the visitor's already
 * authenticated. Pages render their own CTAs and do their own
 * session lookup — same JWT decode, no DB hit.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isSignedIn = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNav isSignedIn={isSignedIn} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
