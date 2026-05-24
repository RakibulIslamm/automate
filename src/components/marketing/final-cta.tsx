'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinalCtaProps {
  isSignedIn?: boolean;
}

const TRUST_BADGES = [
  { icon: Sparkles, label: '50 free runs' },
  { icon: Zap, label: 'Setup in under a minute' },
  { icon: ShieldCheck, label: 'AES-256 encrypted' },
];

/**
 * Final-CTA hero band. Inverted color palette (foreground bg / background
 * text) to break the page rhythm and signal "this is the action". The
 * decorative grid + radial mask + animated prompt chip give it visual
 * weight without going gimmicky.
 */
export function FinalCta({ isSignedIn = false }: FinalCtaProps) {
  const ctaHref = isSignedIn ? '/dashboard/workflows/new' : '/sign-up';
  const ctaLabel = isSignedIn ? 'Build a workflow' : 'Get 50 free runs';
  const secondaryHref = isSignedIn ? '/dashboard' : '/pricing';
  const secondaryLabel = isSignedIn ? 'Open dashboard' : 'See pricing';

  return (
    <section className="relative isolate overflow-hidden border-t border-border/60 bg-foreground text-background">
      {/* Decorative grid — radial-masked so edges fade out cleanly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          color: 'rgb(var(--background-rgb, 250 249 246))',
          maskImage:
            'radial-gradient(circle at center, black 0%, black 35%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(circle at center, black 0%, black 35%, transparent 75%)',
        }}
      />

      {/* Soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.08), transparent)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
        {/* Animated prompt-style chip — visual cue that this is The Pitch */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3 py-1 text-xs text-background/70 backdrop-blur"
        >
          <span className="inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
          AI-built workflows · powered by Claude
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl"
        >
          Stop clicking.
          <br />
          <span className="bg-linear-to-r from-background to-background/60 bg-clip-text text-transparent">
            Start describing.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-base text-background/70 sm:text-lg"
        >
          {isSignedIn
            ? 'You\'re signed in. Drop into the builder and ship your next automation.'
            : 'Sign up in 30 seconds. No card required, no setup wizard, no template gallery to scroll through.'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg" variant="secondary" className="group">
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </motion.div>

        {!isSignedIn ? (
          <motion.ul
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-background/60 sm:text-sm"
          >
            {TRUST_BADGES.map((b) => (
              <li key={b.label} className="inline-flex items-center gap-2">
                <b.icon className="size-3.5 text-background/70" aria-hidden />
                {b.label}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </div>
    </section>
  );
}
