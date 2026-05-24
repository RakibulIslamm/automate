import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

/**
 * Public-facing layout — wraps the landing page, pricing, and legal
 * routes with the shared nav + footer. Kept intentionally minimal: no
 * dashboard chrome, no auth guard. The root layout handles fonts and
 * the theme provider.
 *
 * The warm off-white background and serif headlines are shared with
 * the dashboard so marketing → app feels like one product.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
