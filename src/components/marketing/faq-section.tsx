'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QA {
  q: string;
  a: React.ReactNode;
}

const FAQ: QA[] = [
  {
    q: 'What integrations are supported?',
    a: 'Gmail, Google Drive, Google Calendar, Slack and Notion. Each one connects with secure OAuth — you pick exactly what AutoMate can see.',
  },
  {
    q: 'What counts as a run?',
    a: 'A single workflow execution end-to-end. Manually clicking "Run now" counts as one run. A scheduled cron firing counts as one. A Gmail trigger matching three emails counts as three runs. Failed runs still count.',
  },
  {
    q: 'Can I edit AI-generated workflows?',
    a: 'Yes. After the AI builds a workflow you can rename it, change the trigger, add or remove steps, edit any step\'s config, or just hit save. The Edit page exposes every field.',
  },
  {
    q: 'How secure is my data?',
    a: 'Every OAuth token is encrypted at rest with AES-256-GCM. QStash callbacks are HMAC-signed and verified on every inbound request. We run on Vercel\'s edge with full TLS. Workflow definitions and run history live in MongoDB Atlas; deleting a workflow purges its definition immediately.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — there\'s no contract. The customer portal (linked from the Billing page) lets you cancel or switch plans in two clicks. You keep access until the end of your current billing period.',
  },
  {
    q: 'Do you store my email contents?',
    a: 'Only what a step explicitly reads. A "Save attachment to Drive" step reads attachment bytes, sends them to Drive, and discards them. Trigger metadata (subject, sender, snippet) lives in the run history so you can debug. We don\'t train models on your data — full stop.',
  },
  {
    q: 'What happens if a step fails?',
    a: 'The run is marked failed at that step and the error is recorded in the run detail page. Subsequent steps don\'t execute (fail-fast). You can re-run with the same trigger data, edit the step, or look at the diagnostic info to find the root cause.',
  },
  {
    q: 'Can workflows trigger on a schedule?',
    a: 'Yes — cron triggers run on any schedule you write ("every Monday at 9am", "every weekday at 7:30"). Scheduling runs on Upstash QStash, so it survives Vercel deploys and works on any plan.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Frequently asked
          </h2>
          <p className="mt-3 text-muted-foreground">
            If you don't see your question here, ping us once you're in.
          </p>
        </div>

        <div className="mt-10 divide-y divide-border/60 border-y border-border/60">
          {FAQ.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-medium">{item.q}</span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  className={cn(
                    'overflow-hidden text-sm text-muted-foreground transition-all',
                    isOpen ? 'max-h-96 pb-5' : 'max-h-0',
                  )}
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
