'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  FileText,
  MessageSquare as SlackIcon,
  Sparkles,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FlowNode {
  kind: string;
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

interface Example {
  id: string;
  tab: string;
  prompt: string;
  flow: FlowNode[];
}

const EXAMPLES: Example[] = [
  {
    id: 'email',
    tab: 'Email triage',
    prompt:
      'When a Gmail with "invoice" in the subject arrives, save the attachment to my Drive "Invoices" folder and post a link in #finance with the subject.',
    flow: [
      { kind: 'Trigger', title: 'New Gmail · subject:invoice', icon: Mail },
      { kind: 'Step 1', title: 'Save attachment to Drive · "Invoices"', icon: FileText },
      { kind: 'Step 2', title: 'Post in #finance with the link', icon: SlackIcon },
    ],
  },
  {
    id: 'standup',
    tab: 'Slack standup',
    prompt:
      'Every weekday at 9am, post "Good morning team! Drop your standup updates 👇" to #engineering.',
    flow: [
      { kind: 'Trigger', title: 'Mon–Fri at 09:00', icon: Calendar },
      { kind: 'Step 1', title: 'Post standup reminder in #engineering', icon: SlackIcon },
    ],
  },
  {
    id: 'lead',
    tab: 'Lead capture',
    prompt:
      'When I get a "New lead from form" email, summarize the body, save it to my Notion CRM database with the name + email + summary.',
    flow: [
      { kind: 'Trigger', title: 'New Gmail · "New lead from form"', icon: Mail },
      { kind: 'Step 1', title: 'AI summarize the lead', icon: Sparkles },
      { kind: 'Step 2', title: 'Create Notion page in CRM', icon: FileText },
    ],
  },
];

interface DemoBlockProps {
  isSignedIn?: boolean;
}

export function DemoBlock({ isSignedIn = false }: DemoBlockProps) {
  const [activeId, setActiveId] = useState(EXAMPLES[0]!.id);
  const active = EXAMPLES.find((e) => e.id === activeId) ?? EXAMPLES[0]!;

  return (
    <section id="demo" className="border-y border-border/60 bg-muted/30 py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            See what's possible
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Three real prompts. Three real workflows. Same builder.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Example workflows">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              role="tab"
              type="button"
              aria-selected={ex.id === activeId}
              onClick={() => setActiveId(ex.id)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm transition-colors',
                ex.id === activeId
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {ex.tab}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              Your prompt
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="font-mono text-sm leading-relaxed text-foreground sm:text-[15px]"
              >
                {active.prompt}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm">
            <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
              AutoMate builds
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                {active.flow.map((node, i) => (
                  <motion.div
                    key={`${active.id}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.25 }}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <node.icon className="size-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{node.kind}</p>
                      <p className="text-sm font-medium">{node.title}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href={isSignedIn ? '/dashboard/workflows/new' : '/sign-up'}>
              {isSignedIn ? 'Build your own' : 'Try AutoMate yourself'}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
