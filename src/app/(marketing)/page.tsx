import { buildMetadata } from '@/lib/seo/metadata';
import { getSession } from '@/lib/auth/session';
import { Hero } from '@/components/marketing/hero';
import { DemoBlock } from '@/components/marketing/demo-block';
import { WhySection } from '@/components/marketing/why-section';
import { HowSection } from '@/components/marketing/how-section';
import { UseCasesSection } from '@/components/marketing/use-cases-section';
import { PricingTeaser } from '@/components/marketing/pricing-teaser';
import { FaqSection } from '@/components/marketing/faq-section';
import { FinalCta } from '@/components/marketing/final-cta';

export const metadata = buildMetadata({
  // Keep the root layout's default title for the homepage so search
  // results show the catchy version instead of "Home · AutoMate".
  path: '/',
});

export default async function HomePage() {
  const session = await getSession();
  const isSignedIn = !!session?.user;

  return (
    <>
      <Hero isSignedIn={isSignedIn} />
      <DemoBlock isSignedIn={isSignedIn} />
      <WhySection />
      <HowSection />
      <UseCasesSection />
      <PricingTeaser isSignedIn={isSignedIn} />
      <FaqSection />
      <FinalCta isSignedIn={isSignedIn} />
    </>
  );
}
