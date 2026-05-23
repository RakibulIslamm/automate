import 'server-only';
import { postMessage } from '@/lib/integrations/slack';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';

export const executeSlackPostMessage: Executor<StepOfType<'slack.post_message'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const channel = resolveString(step.config.channel, ctx).trim();
    const text = resolveString(step.config.messageTemplate, ctx);
    result.resolvedConfig = {
      integrationId: step.config.integrationId,
      channel,
      text: text.slice(0, 200) + (text.length > 200 ? '…' : ''),
    };
    if (!channel) throw new Error('Channel resolved to an empty string.');

    const res = await postMessage(step.config.integrationId, { channel, text });
    result.output = { messageTs: res.ts, channel: res.channel };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
