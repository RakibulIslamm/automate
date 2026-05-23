import 'server-only';
import { google, type calendar_v3 } from 'googleapis';
import { ExternalServiceError } from '@/lib/errors';
import { getGoogleAuth } from './google-client';

function wrap<T>(promise: Promise<T>, op: string): Promise<T> {
  return promise.catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : `Calendar request "${op}" failed.`;
    throw new ExternalServiceError('Calendar', message, err);
  });
}

async function getClient(integrationId: string): Promise<calendar_v3.Calendar> {
  const auth = await getGoogleAuth(integrationId);
  return google.calendar({ version: 'v3', auth });
}

export async function getCalendarClient(integrationId: string): Promise<calendar_v3.Calendar> {
  return getClient(integrationId);
}

export interface CreateEventInput {
  calendarId?: string;
  summary: string;
  description?: string;
  start: string | Date;
  end: string | Date;
  attendees?: string[];
  timeZone?: string;
}

export async function createEvent(
  integrationId: string,
  input: CreateEventInput,
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getClient(integrationId);
  const res = await wrap(
    calendar.events.insert({
      calendarId: input.calendarId ?? 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: new Date(input.start).toISOString(), timeZone: input.timeZone },
        end: { dateTime: new Date(input.end).toISOString(), timeZone: input.timeZone },
        attendees: input.attendees?.map((email) => ({ email })),
      },
    }),
    'createEvent',
  );
  return res.data;
}

export interface ListEventsInput {
  calendarId?: string;
  timeMin?: string | Date;
  timeMax?: string | Date;
}

export async function listEvents(
  integrationId: string,
  { calendarId = 'primary', timeMin, timeMax }: ListEventsInput = {},
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getClient(integrationId);
  const res = await wrap(
    calendar.events.list({
      calendarId,
      timeMin: timeMin ? new Date(timeMin).toISOString() : undefined,
      timeMax: timeMax ? new Date(timeMax).toISOString() : undefined,
      singleEvents: true,
      orderBy: 'startTime',
    }),
    'listEvents',
  );
  return res.data.items ?? [];
}
