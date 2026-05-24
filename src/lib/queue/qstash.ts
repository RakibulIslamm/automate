import 'server-only';
import { Client, Receiver, type CreateScheduleRequest } from '@upstash/qstash';
import { env } from '@/lib/env';
import { ExternalServiceError } from '@/lib/errors';

/**
 * QStash client + receiver. The client publishes work — both one-shot
 * (manual runs, Gmail-trigger fan-outs) and cron schedules. The receiver
 * verifies signatures on inbound callbacks so a hostile caller can't
 * inject a fake `workflowId` into the executor.
 */

let _client: Client | null = null;
function client(): Client {
  if (!_client) _client = new Client({ token: env.QSTASH_TOKEN });
  return _client;
}

let _receiver: Receiver | null = null;
function receiver(): Receiver {
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
  }
  return _receiver;
}

function absoluteUrl(path: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export interface EnqueueWorkflowRunInput {
  workflowId: string;
  runId: string;
  triggerData?: unknown;
}

export async function enqueueWorkflowRun(
  input: EnqueueWorkflowRunInput,
): Promise<{ messageId: string }> {
  try {
    const res = await client().publishJSON({
      url: absoluteUrl('/api/qstash/workflow-execute'),
      body: { workflowId: input.workflowId, runId: input.runId, triggerData: input.triggerData },
      // Workflow steps can be slow (AI + Slack + Drive). Don't auto-retry
      // — a failed run is recorded; we don't want it re-running unbidden.
      retries: 0,
    });
    return { messageId: res.messageId };
  } catch (err) {
    throw new ExternalServiceError(
      'QStash',
      'Could not queue the workflow run. Try again in a moment.',
      err,
    );
  }
}

export interface ScheduleWorkflowInput {
  workflowId: string;
  cron: string;
  /**
   * IANA timezone name (e.g. `America/New_York`). When omitted, QStash
   * interprets the cron in UTC, which is rarely what the user means.
   */
  timezone?: string;
}

export async function scheduleWorkflow(
  input: ScheduleWorkflowInput,
): Promise<{ scheduleId: string }> {
  try {
    const cronExpression = buildCronExpression(input.cron, input.timezone);

    const req: CreateScheduleRequest = {
      destination: absoluteUrl('/api/qstash/workflow-execute'),
      cron: cronExpression,
      body: JSON.stringify({ workflowId: input.workflowId, scheduled: true }),
      headers: { 'Content-Type': 'application/json' },
      retries: 0,
    };
    const res = await client().schedules.create(req);
    return { scheduleId: res.scheduleId };
  } catch (err) {
    throw new ExternalServiceError(
      'QStash',
      'Could not register the schedule. Try again in a moment.',
      err,
    );
  }
}

/**
 * QStash reads cron timezone from a `CRON_TZ=<zone>` prefix inside the
 * cron expression itself — there is no separate header. Format:
 *   `CRON_TZ=America/New_York 0 9 * * *`
 *
 * Skips the prefix when no timezone is supplied or the value isn't a
 * valid IANA name (e.g. legacy "BST" entries saved before we shipped
 * the picker) — QStash would otherwise reject the whole schedule.
 */
function buildCronExpression(cron: string, timezone?: string): string {
  if (!timezone) return cron;
  if (!isValidTimezone(timezone)) return cron;
  // Defense: don't double-prefix if the caller already supplied one.
  if (/^\s*CRON_TZ=/.test(cron)) return cron;
  return `CRON_TZ=${timezone} ${cron}`;
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function unscheduleWorkflow(scheduleId: string): Promise<void> {
  try {
    await client().schedules.delete(scheduleId);
  } catch (err) {
    // Best-effort cleanup; log and move on.
    // eslint-disable-next-line no-console
    console.error('[qstash] schedule delete failed', { scheduleId, err });
  }
}

/**
 * Verify a QStash request signature. `body` must be the raw request body
 * (the bytes the signature was computed over) — don't JSON.parse first.
 */
export async function verifyQStashSignature(args: {
  signature: string | null;
  body: string;
  url?: string;
}): Promise<boolean> {
  if (!args.signature) return false;
  try {
    return await receiver().verify({
      signature: args.signature,
      body: args.body,
      url: args.url,
    });
  } catch {
    return false;
  }
}
