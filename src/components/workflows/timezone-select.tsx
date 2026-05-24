'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}

interface ZoneOption {
  /** IANA name, e.g. `America/New_York`. */
  name: string;
  /** Display label, e.g. `America / New York`. */
  label: string;
  /** Continental region for grouping, e.g. `America`. */
  region: string;
  /** Current UTC offset like `GMT-05:00`. */
  offset: string;
  /** Signed minutes (for sort), e.g. `-300` for GMT-5. */
  offsetMinutes: number;
}

/**
 * `Intl.supportedValuesOf('timeZone')` returns every IANA zone the current
 * runtime knows about (typically ~420). It's been available in all major
 * browsers + Node since mid-2022. We compute this once per mount.
 */
function buildZoneList(): ZoneOption[] {
  const names: string[] = (Intl as unknown as {
    supportedValuesOf?: (key: 'timeZone') => string[];
  }).supportedValuesOf?.('timeZone') ?? [];

  const now = new Date();
  return names
    .map<ZoneOption>((name) => {
      const offsetMinutes = getOffsetMinutes(name, now);
      return {
        name,
        label: name.replace(/_/g, ' '),
        region: name.split('/')[0] ?? 'Other',
        offset: formatOffset(offsetMinutes),
        offsetMinutes,
      };
    })
    .sort((a, b) => {
      if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
      return a.name.localeCompare(b.name);
    });
}

function getOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(at);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60)
    .toString()
    .padStart(2, '0');
  const m = (abs % 60).toString().padStart(2, '0');
  return `GMT${sign}${h}:${m}`;
}

function detectBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TimezoneSelect({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => buildZoneList(), []);
  const browserZone = useMemo(() => detectBrowserZone(), []);

  // If `value` isn't a known IANA zone (e.g. legacy "BST"), prepend it to
  // the list so the user can see/keep it without data loss.
  const customZone = useMemo<ZoneOption | null>(() => {
    if (!value) return null;
    if (zones.some((z) => z.name === value)) return null;
    return {
      name: value,
      label: `${value} (custom)`,
      region: 'Custom',
      offset: '—',
      offsetMinutes: 0,
    };
  }, [value, zones]);

  const grouped = useMemo(() => {
    const map = new Map<string, ZoneOption[]>();
    for (const z of zones) {
      if (!map.has(z.region)) map.set(z.region, []);
      map.get(z.region)!.push(z);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [zones]);

  const selectedDisplay =
    customZone ?? zones.find((z) => z.name === value) ?? zones.find((z) => z.name === browserZone);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {selectedDisplay ? selectedDisplay.label : value || 'Pick a timezone…'}
            </span>
          </span>
          <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {selectedDisplay && selectedDisplay.offset !== '—' ? (
              <span className="font-mono tabular-nums">{selectedDisplay.offset}</span>
            ) : null}
            <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command
          // Custom filter so search matches both the IANA name and the
          // pretty label (e.g. "new york" finds "America/New_York").
          filter={(itemValue, search) => {
            const haystack = itemValue.toLowerCase();
            const needle = search.toLowerCase().trim();
            if (!needle) return 1;
            return haystack.includes(needle) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search 400+ timezones…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No timezone matches.</CommandEmpty>

            {customZone || browserZone ? (
              <CommandGroup heading="Quick">
                {customZone ? (
                  <ZoneRow
                    zone={customZone}
                    isSelected={value === customZone.name}
                    onSelect={(z) => {
                      onChange(z);
                      setOpen(false);
                    }}
                  />
                ) : null}
                {browserZone && !zones.every((z) => z.name !== browserZone) ? (
                  <ZoneRow
                    zone={zones.find((z) => z.name === browserZone)!}
                    suffix="Your device"
                    isSelected={value === browserZone}
                    onSelect={(z) => {
                      onChange(z);
                      setOpen(false);
                    }}
                  />
                ) : null}
                <ZoneRow
                  zone={{
                    name: 'UTC',
                    label: 'UTC',
                    region: 'Etc',
                    offset: 'GMT+00:00',
                    offsetMinutes: 0,
                  }}
                  isSelected={value === 'UTC'}
                  onSelect={(z) => {
                    onChange(z);
                    setOpen(false);
                  }}
                />
              </CommandGroup>
            ) : null}

            {grouped.map(([region, items]) => (
              <CommandGroup key={region} heading={region}>
                {items.map((z) => (
                  <ZoneRow
                    key={z.name}
                    zone={z}
                    isSelected={value === z.name}
                    onSelect={(name) => {
                      onChange(name);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ZoneRow({
  zone,
  isSelected,
  onSelect,
  suffix,
}: {
  zone: ZoneOption;
  isSelected: boolean;
  onSelect: (name: string) => void;
  suffix?: string;
}) {
  return (
    <CommandItem
      // cmdk filters on `value`. Combine name + label so search like
      // "new york" matches even though the name has an underscore.
      value={`${zone.name} ${zone.label}`}
      onSelect={() => onSelect(zone.name)}
    >
      <Check
        className={cn('mr-2 size-3.5', isSelected ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      />
      <span className="flex-1 truncate">{zone.label}</span>
      {suffix ? (
        <span className="ml-2 rounded-full border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
      <span className="ml-3 font-mono text-[11px] tabular-nums text-muted-foreground">
        {zone.offset}
      </span>
    </CommandItem>
  );
}
