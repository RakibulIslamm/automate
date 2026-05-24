'use client';

import { useMemo, useState } from 'react';
import cronstrue from 'cronstrue';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TimezoneSelect } from './timezone-select';

export interface SchedulePickerValue {
  cron: string;
  timezone: string;
}

interface Props {
  value: SchedulePickerValue;
  onChange: (next: SchedulePickerValue) => void;
}

interface Preset {
  label: string;
  cron: string;
}

const PRESETS: Preset[] = [
  { label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at 9am', cron: '0 9 * * *' },
  { label: 'Every Monday 9am', cron: '0 9 * * 1' },
  { label: 'Weekdays at 8:30am', cron: '30 8 * * 1-5' },
  { label: 'First of the month', cron: '0 9 1 * *' },
];

/**
 * Cron picker with preset chips and a custom-expression tab. Uses
 * `cronstrue` to render a human-readable preview so users can verify the
 * expression before saving — invalid expressions surface inline.
 */
export function WorkflowSchedulePicker({ value, onChange }: Props) {
  const [tab, setTab] = useState<'presets' | 'custom'>(() =>
    PRESETS.some((p) => p.cron === value.cron) ? 'presets' : 'custom',
  );

  const preview = useMemo(() => {
    if (!value.cron) return { text: '', error: 'Enter a cron expression.' };
    try {
      return { text: cronstrue.toString(value.cron, { use24HourTimeFormat: false }), error: null };
    } catch (err) {
      return { text: '', error: err instanceof Error ? err.message : 'Invalid cron expression.' };
    }
  }, [value.cron]);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'presets' | 'custom')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="mt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => {
              const selected = preset.cron === value.cron;
              return (
                <Button
                  key={preset.cron}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className={cn('justify-between', selected && 'shadow-sm')}
                  onClick={() => onChange({ ...value, cron: preset.cron })}
                >
                  <span>{preset.label}</span>
                  {selected ? <Check className="size-4" /> : null}
                </Button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-3 space-y-1.5">
          <Label htmlFor="cron-expr">Cron expression</Label>
          <Input
            id="cron-expr"
            placeholder="0 9 * * 1-5"
            value={value.cron}
            onChange={(e) => onChange({ ...value, cron: e.target.value })}
            className="font-mono"
            spellCheck={false}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            When
          </Label>
          {preview.error ? (
            <p className="text-sm text-destructive">{preview.error}</p>
          ) : (
            <p className="text-sm font-medium">{preview.text}</p>
          )}
        </div>
        <div className="w-full sm:w-64">
          <Label htmlFor="cron-tz" className="text-xs uppercase tracking-wide text-muted-foreground">
            Timezone
          </Label>
          <TimezoneSelect
            id="cron-tz"
            value={value.timezone}
            onChange={(tz) => onChange({ ...value, timezone: tz })}
          />
        </div>
      </div>
    </div>
  );
}
