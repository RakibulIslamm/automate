import { AlertTriangle } from 'lucide-react';

interface LegalShellProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shared layout for the legal pages. Renders the template warning callout
 * at the top so it's impossible to miss that this is generic boilerplate
 * — anyone shipping the project commercially needs to swap in real terms
 * reviewed by counsel.
 */
export function LegalShell({ title, lastUpdated, children }: LegalShellProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>

      <aside className="mb-10 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>TEMPLATE — review before production use.</strong> This page is
          generic boilerplate intended for portfolio/demo deployment. Replace
          with terms reviewed by qualified legal counsel before serving real
          customers.
        </p>
      </aside>

      <div className="space-y-4 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-medium [&_h3]:text-base [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_p]:my-3 [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </article>
  );
}
