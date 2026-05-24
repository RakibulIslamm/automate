import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy-load the animated demo so the LCP isn't blocked by Framer's
// runtime. The placeholder keeps the layout from jumping.
const HeroTypewriter = dynamic(
  () => import('./hero-typewriter').then((m) => m.HeroTypewriter),
  {
    ssr: true,
    loading: () => <div className="h-[280px] rounded-2xl border border-border/60 bg-card" />,
  },
);

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden />
            Built on Claude · 50 free runs · No card required
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Automate anything you can describe.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Describe an automation in plain English. AutoMate's AI builds and runs
            the workflow across Gmail, Drive, Slack, Notion and Calendar. No
            clicking through menus, no learning curves.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="#demo">
                See examples
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <HeroTypewriter />
        </div>
      </div>
    </section>
  );
}
