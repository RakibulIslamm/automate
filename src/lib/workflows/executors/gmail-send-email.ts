import 'server-only';
import { sendEmail } from '@/lib/integrations/gmail';
import type { StepOfType } from '../dsl';
import { assertOwnsIntegration, type Executor } from './types';
import { failFromError, finalize, resolveString, startResult } from './_shared';

export const executeGmailSendEmail: Executor<StepOfType<'gmail.send_email'>> = async (
  step,
  ctx,
) => {
  const { result, startedAt } = startResult(step.id, step.type);
  try {
    assertOwnsIntegration(ctx, step.config.integrationId);

    const to = resolveString(step.config.toTemplate, ctx).trim();
    const subject = resolveString(step.config.subjectTemplate, ctx);
    const body = resolveString(step.config.bodyTemplate, ctx);
    result.resolvedConfig = { integrationId: step.config.integrationId, to, subject };

    if (!to) throw new Error('Recipient (to) resolved to an empty string.');

    const sent = await sendEmail(step.config.integrationId, { to, subject, body });
    result.output = { messageId: sent.id, threadId: sent.threadId };
    return finalize(result, startedAt);
  } catch (err) {
    return failFromError(result, startedAt, err);
  }
};
