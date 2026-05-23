/**
 * One-shot script: create the QStash recurring schedule that polls Gmail
 * triggers every minute. Re-runs are safe — listing first and skipping
 * if a matching destination already exists.
 *
 * Usage:
 *   pnpm tsx scripts/setup-poll-schedule.ts
 *
 * Requires QSTASH_TOKEN and NEXT_PUBLIC_APP_URL in the environment (the
 * normal .env.local works because env.ts loads from process.env).
 */
import { Client } from '@upstash/qstash';

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!token) {
    // eslint-disable-next-line no-console
    console.error('Missing QSTASH_TOKEN.');
    process.exit(1);
  }
  if (!appUrl) {
    // eslint-disable-next-line no-console
    console.error('Missing NEXT_PUBLIC_APP_URL.');
    process.exit(1);
  }

  const destination = `${appUrl}/api/triggers/poll`;
  const client = new Client({ token });

  const existing = await client.schedules.list();
  const match = existing.find((s) => s.destination === destination);
  if (match) {
    // eslint-disable-next-line no-console
    console.log(`Schedule already exists: ${match.scheduleId}`);
    return;
  }

  const { scheduleId } = await client.schedules.create({
    destination,
    cron: '* * * * *',
    body: JSON.stringify({ kind: 'gmail-trigger-poll' }),
    headers: { 'Content-Type': 'application/json' },
    retries: 0,
  });
  // eslint-disable-next-line no-console
  console.log(`Created poll schedule: ${scheduleId}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
