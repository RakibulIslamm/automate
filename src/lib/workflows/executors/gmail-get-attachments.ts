import 'server-only';
import { getMessage, getAttachment } from '@/lib/integrations/gmail';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';

interface AttachmentRecord {
  name: string;
  mimeType: string;
  size: number;
  /** Base64-encoded contents — fine for downstream `drive.upload_file`. */
  data: string;
  attachmentId: string;
}

/**
 * Fetch a Gmail message and download each attachment. Output:
 *   {
 *     messageId,
 *     attachments: AttachmentRecord[],
 *     items: AttachmentRecord[],   // alias — system prompt uses `items`
 *     count
 *   }
 */
export const executeGmailGetAttachments: Executor<
  StepOfType<'gmail.get_attachments'>
> = async (step, ctx) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const messageId = resolveString(step.config.messageIdFrom, ctx).trim();
    result.resolvedConfig = { integrationId: step.config.integrationId, messageId };
    if (!messageId) {
      throw new Error(`messageIdFrom resolved to an empty string.`);
    }

    const message = await getMessage(step.config.integrationId, messageId);
    const attachments: AttachmentRecord[] = [];

    const walkParts = (parts: typeof message.payload[] = []) => {
      for (const part of parts) {
        if (!part) continue;
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            name: part.filename,
            mimeType: part.mimeType ?? 'application/octet-stream',
            size: part.body.size ?? 0,
            data: '',
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts) walkParts(part.parts);
      }
    };
    walkParts([message.payload]);

    // Download each attachment's bytes in parallel — Gmail's per-call limits
    // are generous enough that 5–10 attachments at once is safe.
    await Promise.all(
      attachments.map(async (a) => {
        const buf = await getAttachment(step.config.integrationId, messageId, a.attachmentId);
        a.data = buf.toString('base64');
        a.size = buf.byteLength;
      }),
    );

    result.output = {
      messageId,
      attachments,
      items: attachments,
      count: attachments.length,
    };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
