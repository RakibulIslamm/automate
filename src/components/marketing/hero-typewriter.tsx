'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Mail, FileText, MessageSquare as SlackIcon, Calendar } from 'lucide-react';

const PROMPTS = [
  'When I get a Gmail with "invoice" in subject, save the attachment to Drive and notify #finance in Slack.',
  'Every Monday at 9am, post a standup reminder to #engineering.',
  'When I get a TODO email, create a task in my Notion Inbox database titled with the subject.',
];

const TYPE_SPEED = 28;
const PAUSE_AFTER_FULL = 2200;
const DELETE_SPEED = 12;
const PAUSE_AFTER_DELETE = 300;

/**
 * Visual demo for the hero — types one of three example prompts character
 * by character, then "generates" a tiny flowchart matching that prompt.
 * Loops. No real AI call, no network. Pure motion choreography meant to
 * make the value prop click in a glance.
 */
export function HeroTypewriter() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    const target = PROMPTS[index];
    if (!target) return;
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (text.length < target.length) {
        timer = setTimeout(() => setText(target.slice(0, text.length + 1)), TYPE_SPEED);
      } else {
        timer = setTimeout(() => setPhase('pausing'), 0);
      }
    } else if (phase === 'pausing') {
      timer = setTimeout(() => setPhase('deleting'), PAUSE_AFTER_FULL);
    } else if (phase === 'deleting') {
      if (text.length > 0) {
        timer = setTimeout(() => setText(text.slice(0, -1)), DELETE_SPEED);
      } else {
        timer = setTimeout(() => {
          setIndex((i) => (i + 1) % PROMPTS.length);
          setPhase('typing');
        }, PAUSE_AFTER_DELETE);
      }
    }
    return () => clearTimeout(timer);
  }, [index, text, phase]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      {/* Prompt panel */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          Workflow prompt
        </div>
        <p className="min-h-28 font-mono text-sm leading-relaxed text-foreground sm:text-[15px]">
          {text}
          <span className="ml-0.5 -mb-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60 align-middle" />
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{phase === 'typing' ? 'AutoMate is listening…' : 'Got it — building.'}</span>
          <span className="font-mono">{Math.min(text.length, (PROMPTS[index]?.length ?? 0))}/{PROMPTS[index]?.length ?? 0}</span>
        </div>
      </div>

      {/* Generated flow panel */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          Generated workflow
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="space-y-2"
          >
            {(SCENARIOS[index] ?? []).map((node, i) => (
              <motion.div
                key={`${index}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 p-3"
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
  );
}

interface FlowNode {
  kind: string;
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const SCENARIOS: FlowNode[][] = [
  [
    { kind: 'Trigger', title: 'New Gmail · subject:invoice', icon: Mail },
    { kind: 'Step 1', title: 'Save attachment to Drive', icon: FileText },
    { kind: 'Step 2', title: 'Post in Slack #finance', icon: SlackIcon },
  ],
  [
    { kind: 'Trigger', title: 'Every Mon at 09:00', icon: Calendar },
    { kind: 'Step 1', title: 'Post standup reminder', icon: SlackIcon },
  ],
  [
    { kind: 'Trigger', title: 'New Gmail · subject:TODO', icon: Mail },
    { kind: 'Step 1', title: 'Create Notion page', icon: FileText },
  ],
];
