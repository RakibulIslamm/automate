'use client';

import { useState, useTransition } from 'react';
import { Check, Eye, EyeOff, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { saveByokAiKey, testByokKey, removeByokKey } from '@/server/actions/byok';
import { AI_MODELS, defaultModelFor } from '@/lib/byok/pricing';
import type { ByokAiProvider, ByokStatus } from '@/lib/db/models';

export interface ByokAiKeyView {
  provider: ByokAiProvider;
  last4: string;
  selectedModel: string | null;
  status: ByokStatus;
  lastTestedAt: string | null;
}

interface Props {
  /** Existing saved keys keyed by provider — used to populate read-only state. */
  keys: Partial<Record<ByokAiProvider, ByokAiKeyView>>;
}

const PROVIDERS: Array<{ id: ByokAiProvider; label: string; help: string; placeholder: string }> = [
  { id: 'openai', label: 'OpenAI', help: 'platform.openai.com/api-keys', placeholder: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', help: 'console.anthropic.com', placeholder: 'sk-ant-…' },
  { id: 'openrouter', label: 'OpenRouter', help: 'openrouter.ai/keys', placeholder: 'sk-or-…' },
  { id: 'deepseek', label: 'DeepSeek', help: 'platform.deepseek.com', placeholder: 'sk-…' },
];

function pickDefaultTab(keys: Partial<Record<ByokAiProvider, ByokAiKeyView>>): ByokAiProvider {
  const saved = PROVIDERS.map((p) => keys[p.id]).filter(
    (k): k is ByokAiKeyView => k != null,
  );
  if (saved.length === 0) return 'anthropic';
  const mostRecent = saved.reduce((best, cur) => {
    const bestAt = best.lastTestedAt ? Date.parse(best.lastTestedAt) : 0;
    const curAt = cur.lastTestedAt ? Date.parse(cur.lastTestedAt) : 0;
    return curAt > bestAt ? cur : best;
  });
  return mostRecent.provider;
}

export function ByokAiSection({ keys }: Props) {
  const [activeTab, setActiveTab] = useState<ByokAiProvider>(() => pickDefaultTab(keys));
  const current = PROVIDERS.find((p) => p.id === activeTab)!;
  const saved = keys[activeTab];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <p className="mb-4 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Costs from your key are billed by the provider, not by us. We store the key
        encrypted (AES-256-GCM) and only decrypt it at call time. The key is never
        shown again after saving — only the last 4 characters.
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {PROVIDERS.map((p) => {
          const isActive = p.id === activeTab;
          const hasKey = keys[p.id] != null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
              {hasKey ? (
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    isActive ? 'bg-background/70' : 'bg-emerald-500',
                  )}
                  aria-label="connected"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <ProviderPanel
        key={current.id /* reset internal state on tab change */}
        provider={current.id}
        label={current.label}
        help={current.help}
        placeholder={current.placeholder}
        saved={saved ?? null}
      />
    </div>
  );
}

function ProviderPanel({
  provider,
  label,
  help,
  placeholder,
  saved,
}: {
  provider: ByokAiProvider;
  label: string;
  help: string;
  placeholder: string;
  saved: ByokAiKeyView | null;
}) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState<string>(saved?.selectedModel ?? defaultModelFor(provider));
  const [savePending, startSave] = useTransition();
  const [testPending, startTest] = useTransition();
  const [removePending, startRemove] = useTransition();

  const models = AI_MODELS[provider];

  function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error('Paste your API key first.');
      return;
    }
    startSave(async () => {
      const res = await saveByokAiKey({ provider, apiKey: trimmed, model });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${label} key saved and tested.`);
      setApiKey('');
    });
  }

  function handleTest() {
    startTest(async () => {
      const res = await testByokKey({ provider });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      if (res.data.status === 'active') {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const res = await removeByokKey({ provider });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${label} key removed.`);
    });
  }

  return (
    <div className="space-y-5">
      {/* Saved-state strip */}
      {saved ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                saved.status === 'active'
                  ? 'border-emerald-500/40 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : saved.status === 'rate_limited'
                    ? 'border-amber-500/40 bg-amber-50/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'border-rose-500/40 bg-rose-50/50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  saved.status === 'active'
                    ? 'bg-emerald-500'
                    : saved.status === 'rate_limited'
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                )}
              />
              {saved.status}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {saved.last4}
            </span>
            {saved.selectedModel ? (
              <span className="text-xs text-muted-foreground">· {saved.selectedModel}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleTest} disabled={testPending}>
              {testPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
              Test
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={removePending}>
              {removePending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Remove
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`byok-${provider}-key`} className="text-xs uppercase tracking-wide text-muted-foreground">
          {saved ? 'Replace API key' : 'API key'}
        </Label>
        <div className="relative">
          <Input
            id={`byok-${provider}-key`}
            type={showKey ? 'text' : 'password'}
            placeholder={placeholder}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute inset-y-0 right-2 inline-flex items-center text-muted-foreground hover:text-foreground"
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get a key from{' '}
          <a
            href={`https://${help}`}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-2 hover:underline"
          >
            {help}
          </a>
          . Tested live before saving.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`byok-${provider}-model`} className="text-xs uppercase tracking-wide text-muted-foreground">
          Default model
        </Label>
        <select
          id={`byok-${provider}-model`}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — ${m.inputPer1M.toFixed(2)} in / ${m.outputPer1M.toFixed(2)} out per 1M tokens
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={handleSave} disabled={savePending || !apiKey.trim()}>
          {savePending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Testing & saving…
            </>
          ) : (
            <>
              <Check className="size-4" />
              {saved ? 'Save changes' : 'Save key'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
