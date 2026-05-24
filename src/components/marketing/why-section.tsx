import { Sparkles, Plug, Brain } from 'lucide-react';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'No-code, no clicks',
    body: 'Describe what you want in plain English. The AI builds the workflow. You review and run.',
  },
  {
    icon: Plug,
    title: 'Your tools, connected',
    body: 'Gmail, Drive, Slack, Notion, Calendar — connect once with secure OAuth, use everywhere.',
  },
  {
    icon: Brain,
    title: 'Powered by Claude',
    body: 'Best-in-class reasoning means workflows that actually work — not brittle if/then trees.',
  },
];

export function WhySection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Why AutoMate
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three things make this feel different.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/60 bg-card p-6"
            >
              <div className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
                <f.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-5 font-serif text-xl tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
