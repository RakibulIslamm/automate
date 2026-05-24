import Link from 'next/link';
import { Code2, Globe } from 'lucide-react';

const SECTIONS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'Use cases', href: '/#use-cases' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Sign up', href: '/sign-up' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
    ],
  },
];

const SOCIAL: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }> = [
  { label: 'GitHub', href: 'https://github.com/', icon: Code2 },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', icon: Globe },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2 font-serif text-lg tracking-tight">
              <span className="inline-block size-3 rounded-sm bg-foreground" aria-hidden />
              AutoMate
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Describe an automation. AutoMate's AI builds and runs it across your tools.
            </p>
          </div>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AutoMate. All rights reserved.</p>
          <div className="flex items-center gap-3">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={s.label}
              >
                <s.icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
