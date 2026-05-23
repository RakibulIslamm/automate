import 'server-only';
import { createPage, type CreatePageInput } from '@/lib/integrations/notion';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveValue, startResult } from './_shared';

export const executeNotionCreatePage: Executor<StepOfType<'notion.create_page'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    // Interpolate every leaf string in the property template so `{{…}}`
    // refs inside nested Notion property shapes resolve correctly.
    const properties = resolveValue(step.config.propertiesTemplate, ctx) as Record<
      string,
      unknown
    >;
    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      databaseId: step.config.databaseId,
      properties,
    };

    // Notion v5 SDK splits "database" and "data_source" — the DSL field is
    // still called `databaseId` for user familiarity, and the SDK accepts
    // it under `parent.data_source_id` for data-source-scoped pages.
    const input: CreatePageInput = {
      parent: { data_source_id: step.config.databaseId },
      properties: properties as CreatePageInput['properties'],
    };

    const page = await createPage(step.config.integrationId, input);
    const url = 'url' in page && typeof page.url === 'string' ? page.url : null;
    result.output = { pageId: page.id, url };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
