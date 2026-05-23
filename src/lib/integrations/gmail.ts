import 'server-only';
import { google, type gmail_v1 } from 'googleapis';
import { ExternalServiceError } from '@/lib/errors';
import { getGoogleAuth } from './google-client';

async function getClient(integrationId: string): Promise<gmail_v1.Gmail> {
  const auth = await getGoogleAuth(integrationId);
  return google.gmail({ version: 'v1', auth });
}

export async function getGmailClient(integrationId: string): Promise<gmail_v1.Gmail> {
  return getClient(integrationId);
}

function wrap<T>(promise: Promise<T>, op: string): Promise<T> {
  return promise.catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : `Gmail request "${op}" failed.`;
    throw new ExternalServiceError('Gmail', message, err);
  });
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
}

export async function getProfile(integrationId: string): Promise<GmailProfile> {
  const gmail = await getClient(integrationId);
  const res = await wrap(gmail.users.getProfile({ userId: 'me' }), 'getProfile');
  return {
    emailAddress: res.data.emailAddress ?? '',
    messagesTotal: res.data.messagesTotal ?? 0,
    threadsTotal: res.data.threadsTotal ?? 0,
  };
}

export interface ListEmailsOptions {
  query?: string;
  maxResults?: number;
}

export async function listEmails(
  integrationId: string,
  { query, maxResults = 25 }: ListEmailsOptions = {},
): Promise<gmail_v1.Schema$Message[]> {
  const gmail = await getClient(integrationId);
  const res = await wrap(
    gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    }),
    'listEmails',
  );
  return res.data.messages ?? [];
}

export async function getMessage(
  integrationId: string,
  messageId: string,
): Promise<gmail_v1.Schema$Message> {
  const gmail = await getClient(integrationId);
  const res = await wrap(
    gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }),
    'getMessage',
  );
  return res.data;
}

export async function getAttachment(
  integrationId: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const gmail = await getClient(integrationId);
  const res = await wrap(
    gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    }),
    'getAttachment',
  );
  const data = res.data.data ?? '';
  return Buffer.from(data, 'base64url');
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  /** Optional inline HTML body. If set, sent as multipart/alternative. */
  html?: string;
}

export async function sendEmail(
  integrationId: string,
  { to, subject, body, html }: SendEmailInput,
): Promise<gmail_v1.Schema$Message> {
  const gmail = await getClient(integrationId);
  const raw = buildRawMessage({ to, subject, text: body, html });
  const res = await wrap(
    gmail.users.messages.send({ userId: 'me', requestBody: { raw } }),
    'sendEmail',
  );
  return res.data;
}

/**
 * Build an RFC 5322 / RFC 2045 message ready for Gmail's `messages.send`.
 *
 * Two things matter here that the original implementation got wrong:
 *
 * 1. Headers and body MUST be separated by an empty line (`\r\n\r\n`). With
 *    only one `\r\n` some clients (notably Gmail mobile) treat the whole
 *    blob as headers and the body disappears.
 *
 * 2. Subject lines containing non-ASCII bytes (emojis, accents…) MUST be
 *    encoded with RFC 2047 encoded-word syntax — `=?UTF-8?B?<base64>?=`.
 *    Raw UTF-8 in the header gets reinterpreted as Latin-1 by many MUAs,
 *    producing the classic `Ã°ÂŸÂ’Âª` mojibake.
 *
 * Body is sent base64-encoded with `Content-Transfer-Encoding: base64` so
 * emoji-laden bodies transit safely without quoted-printable line-length
 * headaches.
 */
function buildRawMessage(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): string {
  const boundary = `boundary_${Math.random().toString(36).slice(2)}`;
  const subjectHeader = encodeHeaderValue(args.subject);

  const headers = [
    `To: ${args.to}`,
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
  ];

  const bodyChunks: string[] = [];
  if (args.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    bodyChunks.push(
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      base64Wrap(args.text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      base64Wrap(args.html),
      `--${boundary}--`,
    );
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    bodyChunks.push(base64Wrap(args.text));
  }

  // The empty string between headers and body produces the required blank
  // line: `\r\n\r\n`. Without it, the body silently goes missing.
  const message = [...headers, '', ...bodyChunks].join('\r\n');
  return Buffer.from(message, 'utf-8').toString('base64url');
}

/**
 * RFC 2047 encoded-word for a single header value. Returns the input
 * unchanged when it's pure ASCII (saves bytes and avoids unnecessary
 * decoding by clients).
 */
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const encoded = Buffer.from(value, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/** Base64-encode then wrap to 76-char lines per RFC 2045 §6.8. */
function base64Wrap(input: string): string {
  const encoded = Buffer.from(input, 'utf-8').toString('base64');
  return encoded.replace(/(.{76})/g, '$1\r\n');
}
