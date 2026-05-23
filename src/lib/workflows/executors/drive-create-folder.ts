import 'server-only';
import { findOrCreateFolder } from '@/lib/integrations/drive';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';

export const executeDriveCreateFolder: Executor<StepOfType<'drive.create_folder'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const name = resolveString(step.config.name, ctx);
    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      name,
      parentId: step.config.parentId,
    };
    if (!name) throw new Error('Folder name resolved to an empty string.');

    // The current adapter only takes a name; parentId support lives in
    // Phase 11's expanded Drive adapter. For now we surface it via the
    // resolved config and ignore it during the call.
    const folderId = await findOrCreateFolder(step.config.integrationId, name);

    result.output = { folder: { id: folderId, name } };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
