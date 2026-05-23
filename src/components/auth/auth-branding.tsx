import { cn } from '@/lib/utils';

export interface AuthBrandingProps {
  className?: string;
  reverse?: boolean;
}

/**
 * Right-hand (or left-hand) panel of the split sign-in/sign-up layout.
 * Placeholder visual until we have product screenshots — a soft radial
 * gradient with the AutoMate wordmark and tagline.
 */
export function AuthBranding({ className, reverse = false }: AuthBrandingProps) {
  return (
    <aside
      aria-hidden
      className={cn(
        'relative overflow-hidden bg-zinc-950 text-zinc-50 dark:bg-black',
        'flex items-center justify-center px-12 py-16',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 opacity-70',
          reverse
            ? 'bg-[radial-gradient(circle_at_30%_70%,#1e293b,transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_70%_30%,#1e293b,transparent_60%)]',
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.04),transparent_70%)]" />
      <div className="relative max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">AutoMate</p>
        <h2 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
          Describe it.
          <br />
          AutoMate runs it.
        </h2>
        <p className="mt-6 max-w-sm text-base text-zinc-300">
          Plain-English automations that connect Gmail, Drive, Slack, Notion and Calendar — built by an
          AI agent, run on your schedule.
        </p>
      </div>
    </aside>
  );
}
