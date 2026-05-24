import 'server-only';
import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import { ExternalServiceError } from '@/lib/errors';
import { getGoogleAuth } from './google-client';

function wrap<T>(promise: Promise<T>, op: string): Promise<T> {
  return promise.catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : `Drive request "${op}" failed.`;
    throw new ExternalServiceError('Drive', message, err);
  });
}

async function getClient(integrationId: string): Promise<drive_v3.Drive> {
  const auth = await getGoogleAuth(integrationId);
  return google.drive({ version: 'v3', auth });
}

export async function getDriveClient(integrationId: string): Promise<drive_v3.Drive> {
  return getClient(integrationId);
}

export async function findOrCreateFolder(
  integrationId: string,
  folderName: string,
): Promise<string> {
  const drive = await getClient(integrationId);
  const list = await wrap(
    drive.files.list({
      q: `name = '${escapeForDriveQuery(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    }),
    'findOrCreateFolder.list',
  );
  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await wrap(
    drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    }),
    'findOrCreateFolder.create',
  );
  if (!created.data.id) throw new ExternalServiceError('Drive', 'Folder creation returned no id.');
  return created.data.id;
}

export interface UploadFileInput {
  folderId?: string;
  name: string;
  content: Buffer | string;
  mimeType: string;
}

export async function uploadFile(
  integrationId: string,
  { folderId, name, content, mimeType }: UploadFileInput,
): Promise<drive_v3.Schema$File> {
  const drive = await getClient(integrationId);
  const body = typeof content === 'string' ? Buffer.from(content) : content;
  const res = await wrap(
    drive.files.create({
      requestBody: {
        name,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType,
        body: Readable.from(body),
      },
      fields: 'id, name, webViewLink, mimeType',
    }),
    'uploadFile',
  );
  return res.data;
}

export async function listFiles(
  integrationId: string,
  query?: string,
): Promise<drive_v3.Schema$File[]> {
  const drive = await getClient(integrationId);
  const res = await wrap(
    drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
      pageSize: 50,
    }),
    'listFiles',
  );
  return res.data.files ?? [];
}

export interface DriveFolderRef {
  id: string;
  name: string;
}

/**
 * Folders the user can see, capped at 100 — enough for a dropdown UI.
 * Excludes trashed folders and sorts by recency so the most-likely
 * targets float to the top.
 */
export async function listFolders(integrationId: string): Promise<DriveFolderRef[]> {
  const drive = await getClient(integrationId);
  const res = await wrap(
    drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    }),
    'listFolders',
  );
  return (res.data.files ?? [])
    .filter((f): f is drive_v3.Schema$File & { id: string; name: string } =>
      Boolean(f.id && f.name),
    )
    .map((f) => ({ id: f.id, name: f.name }));
}

function escapeForDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
