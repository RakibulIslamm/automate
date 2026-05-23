'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { DASHBOARD_NAV_BOTTOM, DASHBOARD_NAV_MAIN } from './nav-config';

/**
 * App-wide command palette. Mounted once in the dashboard layout. Opens on
 * ⌘K / Ctrl+K, or programmatically via `dispatchOpenCommandPalette()`.
 */

const OPEN_EVENT = 'automate:open-command-palette';

export function openCommandPalette(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);

    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Type a command or search…"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {[...DASHBOARD_NAV_MAIN, ...DASHBOARD_NAV_BOTTOM].map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                onSelect={() => navigate(item.href)}
                value={`navigate ${item.label}`}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden />
                <span>{item.label}</span>
                {item.description ? (
                  <span className="ml-auto text-xs text-muted-foreground">{item.description}</span>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Create">
          <CommandItem
            onSelect={() => navigate('/dashboard/workflows/new')}
            value="create new workflow"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            <span>New Workflow</span>
            <span className="ml-auto text-xs text-muted-foreground">Describe an automation</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
