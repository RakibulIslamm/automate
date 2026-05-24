'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#use-cases', label: 'Use cases' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

interface MarketingNavProps {
  isSignedIn?: boolean;
}

/**
 * Sticky marketing nav. Right side flips between auth pair
 * (Sign in + Start free) and a single "Open dashboard" pill when the
 * visitor's signed in. Mobile collapses to an overlay sheet.
 */
export function MarketingNav({ isSignedIn = false }: MarketingNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-lg tracking-tight"
          onClick={() => setOpen(false)}
        >
          <span className="inline-block size-3 rounded-sm bg-foreground" aria-hidden />
          AutoMate
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isSignedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                Open dashboard
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Start free</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          'border-t border-border/40 bg-background md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-border/40 pt-3">
            {isSignedIn ? (
              <Button asChild size="sm" className="flex-1">
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  Open dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="flex-1">
                  <Link href="/sign-in" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/sign-up" onClick={() => setOpen(false)}>
                    Start free
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
