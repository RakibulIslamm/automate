/**
 * One-shot script: create the QStash recurring schedule that polls Gmail
 * triggers every minute. Re-runs are safe — lists first and skips if a
 * matching destination already exists.
 *
 * Usage:
 *   pnpm tsx scripts/setup-poll-schedule.ts
 *
 * Reads QSTASH_TOKEN and NEXT_PUBLIC_APP_URL from .env.local (loaded
 * manually here — tsx doesn't auto-load env files the way `next dev` does).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@upstash/qstash';

loadEnvFile('.env.local');

function loadEnvFile(file: string): void {
  try {
    const contents = readFileSync(resolve(process.cwd(), file), 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Don't clobber values the shell already set.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env.local optional — process.env may already be populated.
  }
}

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
