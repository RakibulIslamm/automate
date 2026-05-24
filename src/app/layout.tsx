import type { Metadata } from 'next';
import { Geist, Geist_Mono, Fraunces } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  // Variable axes: SOFT softens terminals, opsz auto-tunes for size.
  // We pin SOFT to a mid value so headlines feel warm but not playful.
  axes: ['SOFT', 'opsz'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AutoMate — AI-powered workflow automation',
    template: '%s · AutoMate',
  },
  description:
    'Describe an automation in plain English. AutoMate builds the workflow and runs it across your connected accounts — Gmail, Drive, Slack, Notion, Calendar.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'h-full antialiased',
        geistSans.variable,
        geistMono.variable,
        fraunces.variable,
      )}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <TooltipProvider delayDuration={150}>
            <ErrorBoundary>{children}</ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
