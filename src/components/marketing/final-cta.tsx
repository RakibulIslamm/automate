import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="border-t border-border/60 bg-foreground py-20 text-background">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">
          Stop clicking. Start describing.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-background/70">
          Sign up in 30 seconds. 50 free runs, no card required, no credit checks.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-up">Get 50 free runs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
