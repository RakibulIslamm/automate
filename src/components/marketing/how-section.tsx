import { Plug, MessageSquare, Play } from 'lucide-react';

const STEPS = [
  {
    n: '01',
    icon: Plug,
    title: 'Connect your tools',
    body: 'Sign in with Google, Slack, and Notion. OAuth tokens are encrypted at rest with AES-256-GCM.',
  },
  {
    n: '02',
    icon: MessageSquare,
    title: 'Describe your workflow',
    body: 'Type what you want in a textarea. The AI emits a structured workflow you can review or edit.',
  },
  {
    n: '03',
    icon: Play,
    title: 'Watch it run',
    body: 'Run on a schedule, when an email arrives, or on-demand. Every step is logged with timing and cost.',
  },
];

export function HowSection() {
  return (
    <section id="how" className="border-y border-border/60 bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps. No template gallery to scroll through.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-border/60 bg-background p-6"
            >
              <div className="absolute right-5 top-5 font-mono text-xs text-muted-foreground/60">
                {s.n}
              </div>
              <div className="grid size-10 place-items-center rounded-lg bg-foreground text-background">
                <s.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-5 font-serif text-xl tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
