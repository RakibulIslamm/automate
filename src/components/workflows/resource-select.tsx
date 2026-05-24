'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ResourceOption {
  id: string;
  label: string;
  sublabel?: string;
  /** Inline warning shown under the picker when this option is selected.
   * Used by the Slack picker for private channels the bot isn't in yet. */
  warning?: string;
}

interface Props {
  /** Endpoint that returns `{ data: { <listKey>: ResourceOption[] } }`. */
  fetchUrl: string;
  /** Key the API uses inside `data` (e.g. "databases", "channels", "folders"). */
  listKey: string;
  /** Currently selected resource id (or template ref / custom string). */
  value: string;
  onChange: (next: string) => void;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Disable the control while the parent is saving etc. */
  disabled?: boolean;
  /** Label for the "type custom value" affordance (e.g. "Paste id manually"). */
  customLabel?: string;
}

interface ApiResponse {
  data?: Record<
    string,
    Array<{
      id: string;
      title?: string;
      name?: string;
      is_private?: boolean;
      is_member?: boolean;
      warning?: string;
    }>
  >;
  error?: { message?: string };
}

/**
 * Pick-from-list resource selector with a "use custom value" escape hatch.
 *
 * The dropdown fetches options once on mount (cached for the dialog's
 * lifetime). If the API call fails or the user wants to paste a template
 * ref like `{{trigger.x}}`, the "Custom" link swaps the select for a free
 * text input — so the user is never locked out.
 */
export function ResourceSelect({
  fetchUrl,
  listKey,
  value,
  onChange,
  placeholder = 'Pick one…',
  disabled,
  customLabel = 'Paste id manually',
}: Props) {
  const [options, setOptions] = useState<ResourceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(fetchUrl, { cache: 'no-store' });
        const body = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error?.message ?? 'Could not load options.');
          setOptions([]);
          setCustomMode(true); // fall back to free text so the user isn't stuck
          return;
        }
        const raw = body.data?.[listKey] ?? [];
        const mapped: ResourceOption[] = raw.map((entry) => {
          const needsInvite = entry.is_private === true && entry.is_member === false;
          // Build a sublabel that hints at the state right in the option
          // text so the user can scan the dropdown without selecting.
          const parts: string[] = [];
          if (entry.is_private) parts.push('private');
          if (needsInvite) parts.push('needs invite');
          return {
            id: entry.id,
            label: entry.title ?? entry.name ?? entry.id,
            sublabel: parts.length > 0 ? parts.join(' · ') : undefined,
            warning: entry.warning,
          };
        });
        setOptions(mapped);
        // If the current value isn't in the fetched list and looks like
        // a real id (not empty / not a template), surface as custom by
        // default so the user understands what they're looking at.
        if (
          value &&
          !mapped.some((o) => o.id === value) &&
          !value.includes('{{')
        ) {
          setCustomMode(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load options.');
          setOptions([]);
          setCustomMode(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // We deliberately depend on the URL only — value changes shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, listKey]);

  if (customMode) {
    return (
      <div className="space-y-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setCustomMode(false)}
          disabled={disabled || loading}
        >
          <RotateCcw className="size-3" aria-hidden />
          Pick from list
        </button>
        {error ? (
          <p className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="size-3" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }

  const hasOptions = (options?.length ?? 0) > 0;
  const selectedWarning = options?.find((o) => o.id === value)?.warning ?? null;

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !hasOptions}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {value && !options?.some((o) => o.id === value) ? (
          <option value={value}>{value} (not in list)</option>
        ) : null}
        {!value ? <option value="">{placeholder}</option> : null}
        {options?.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
            {opt.sublabel ? ` · ${opt.sublabel}` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setCustomMode(true)}
        disabled={disabled}
      >
        {customLabel}
      </button>
      {!hasOptions ? (
        <p className="text-xs text-amber-600">
          Nothing here yet — share a resource with the AutoMate integration in the connected app,
          or use “{customLabel}”.
        </p>
      ) : null}
      {selectedWarning ? (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-50/40 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{selectedWarning}</span>
        </div>
      ) : null}
    </div>
  );
}
