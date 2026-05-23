import 'server-only';
import { findOrCreateFolder, uploadFile } from '@/lib/integrations/drive';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, resolveValue, startResult } from './_shared';

/**
 * The "file" the executor expects from `fileFrom`. We accept either:
 *  - the attachment record produced by `gmail.get_attachments`
 *    (`{ name, mimeType, data: base64, ... }`)
 *  - a plain `string` (treated as base64 text/plain if no name available)
 *  - a `{ name, mimeType, data }` object from another step
 */
function coerceFile(raw: unknown):
  | { name: string | null; mimeType: string; data: Buffer }
  | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    return { name: null, mimeType: 'text/plain', data: Buffer.from(raw, 'utf8') };
  }
  if (typeof raw === 'object' && 'data' in raw) {
    const obj = raw as { name?: string; mimeType?: string; data: string | Buffer };
    const data =
      typeof obj.data === 'string' ? Buffer.from(obj.data, 'base64') : obj.data;
    return {
      name: obj.name ?? null,
      mimeType: obj.mimeType ?? 'application/octet-stream',
      data,
    };
  }
  return null;
}

export const executeDriveUploadFile: Executor<StepOfType<'drive.upload_file'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const rawFile = resolveValue(step.config.fileFrom, ctx);
    const file = coerceFile(rawFile);
    if (!file) {
      throw new Error(
        `fileFrom resolved to an unsupported value — expected an object with a base64 \`data\` field.`,
      );
    }

    let folderId = step.config.folderId;
    if (!folderId && step.config.folderName) {
      const folderName = resolveString(step.config.folderName, ctx);
      folderId = await findOrCreateFolder(step.config.integrationId, folderName);
    }

    const filename =
      (step.config.filenameTemplate
        ? resolveString(step.config.filenameTemplate, ctx)
        : file.name) ?? 'upload';

    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      folderId,
      filename,
      mimeType: file.mimeType,
      bytes: file.data.byteLength,
    };

    const uploaded = await uploadFile(step.config.integrationId, {
      folderId,
      name: filename,
      content: file.data,
      mimeType: file.mimeType,
    });

    result.output = {
      file: {
        id: uploaded.id,
        name: uploaded.name,
        webViewLink: uploaded.webViewLink,
        mimeType: uploaded.mimeType,
      },
      folderId,
    };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
