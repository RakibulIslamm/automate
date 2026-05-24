'use client';

import { useState } from 'react';
import { Briefcase, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UseCase {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  prompt: string;
  steps: string[];
}

const CASES: UseCase[] = [
  {
    id: 'sales',
    label: 'Sales',
    icon: Briefcase,
    prompt:
      'When a "New lead from form" email arrives, summarize the body and save it to my Notion CRM. Notify #sales with the name and summary.',
    steps: [
      'Trigger · New Gmail · "New lead from form"',
      'AI · Summarize the body',
      'Notion · Create CRM page',
      'Slack · Post in #sales',
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    icon: Settings,
    prompt:
      'When I get a Gmail with "invoice" in the subject, save the attachment to my Drive "Invoices" folder and log it in Notion.',
    steps: [
      'Trigger · New Gmail · subject:invoice',
      'Drive · Save attachment to Invoices/',
      'Notion · Create page in Invoice Log',
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: User,
    prompt:
      'Every weekday at 7:30am, summarize my Google Calendar for the day and email it to me.',
    steps: [
      'Trigger · Weekdays at 07:30',
      'Calendar · Fetch today\'s events',
      'AI · Summarize the day',
      'Gmail · Send to me',
    ],
  },
];

export function UseCasesSection() {
  const [activeId, setActiveId] = useState(CASES[0]!.id);
  const active = CASES.find((c) => c.id === activeId) ?? CASES[0]!;

  return (
    <section id="use-cases" className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Built for the work you actually do
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sales, ops, personal — same builder, same five-second setup.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {CASES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              aria-selected={activeId === c.id}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
                activeId === c.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <c.icon className="size-3.5" aria-hidden />
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 rounded-2xl border border-border/60 bg-card p-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              The prompt
            </p>
            <p className="mt-2 font-mono text-sm leading-relaxed">{active.prompt}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              What AutoMate builds
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {active.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-muted-foreground">›</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
