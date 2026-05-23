import 'server-only';
import { createEvent } from '@/lib/integrations/calendar';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';

export const executeCalendarCreateEvent: Executor<
  StepOfType<'calendar.create_event'>
> = async (step, ctx) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const summary = resolveString(step.config.summary, ctx);
    const start = resolveString(step.config.startTimeTemplate, ctx);
    const end = resolveString(step.config.endTimeTemplate, ctx);
    const description = step.config.descriptionTemplate
      ? resolveString(step.config.descriptionTemplate, ctx)
      : undefined;

    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      summary,
      start,
      end,
      description,
    };

    if (!summary) throw new Error('summary resolved to an empty string.');
    if (!start || !end) throw new Error('start/end resolved to an empty string.');

    const event = await createEvent(step.config.integrationId, {
      summary,
      description,
      start,
      end,
    });

    result.output = {
      eventId: event.id,
      htmlLink: event.htmlLink,
      start: event.start?.dateTime ?? null,
      end: event.end?.dateTime ?? null,
    };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
