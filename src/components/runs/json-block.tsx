'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  value: unknown;
  /** Soft cap; data above this gets truncated with a "show more" toggle. */
  collapseAfterChars?: number;
}

/**
 * Pretty-printed JSON viewer with copy-to-clipboard. No syntax highlight
 * library — keeps the bundle lean. Truncates very large payloads so a
 * massive Gmail attachment doesn't crash the rendering.
 */
export function JsonBlock({ value, collapseAfterChars = 4000 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatted = formatJson(value);
  const tooBig = formatted.length > collapseAfterChars;
  const visible = expanded || !tooBig
    ? formatted
    : formatted.slice(0, collapseAfterChars) + '\n…';

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail on insecure contexts; silently swallow —
      // the user can still select+copy manually.
    }
  }

  return (
    <div className="relative rounded-md border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">JSON · {formatted.length} chars</span>
        <div className="flex items-center gap-1">
          {tooBig ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Collapse' : 'Show full'}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={copy}
            aria-label="Copy to clipboard"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="whitespace-pre font-mono">{visible}</code>
      </pre>
    </div>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, replacer, 2);
  } catch (err) {
    return `// Unable to serialise: ${(err as Error).message}`;
  }
}

/**
 * Truncate giant base64 strings (Gmail attachment payloads can be MB+)
 * so the JSON viewer stays usable. Anything else passes through.
 */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > 2000) {
    return `${value.slice(0, 200)}… (${value.length} chars truncated)`;
  }
  return value;
}
