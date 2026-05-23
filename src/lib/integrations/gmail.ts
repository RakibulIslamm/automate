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

function buildRawMessage(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): string {
  const boundary = `boundary_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    'MIME-Version: 1.0',
  ];

  let body: string;
  if (args.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      args.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      args.html,
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    body = `\r\n${args.text}`;
  }

  return Buffer.from(`${headers.join('\r\n')}${body}`, 'utf-8').toString('base64url');
}
