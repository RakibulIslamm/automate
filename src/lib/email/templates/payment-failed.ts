import { env } from '@/lib/env';

interface PaymentFailedInput {
  name: string | null;
  invoiceUrl: string | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Plain-text + HTML payment-failed email. Kept intentionally short:
 * one CTA (update payment method) and a fallback link to the AutoMate
 * billing page. We don't surface env var or stack details — that
 * info stays in the server log.
 */
export function renderPaymentFailedEmail(input: PaymentFailedInput): RenderedEmail {
  const greetingName = input.name?.trim() || 'there';
  const billingUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard/billing`;
  const ctaUrl = input.invoiceUrl ?? billingUrl;

  const subject = 'AutoMate: your payment didn\'t go through';

  const text = [
    `Hi ${greetingName},`,
    '',
    'We tried to charge the card on file for your AutoMate subscription and the payment was declined.',
    '',
    `Update your payment method to keep your workflows running: ${ctaUrl}`,
    '',
    'If you think this was an error, reply to this email and we\'ll take a look.',
    '',
    '— The AutoMate team',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:560px; margin:0 auto; color:#1a1a1a;">
      <h1 style="font-size:18px; margin:0 0 16px;">Your payment didn't go through</h1>
      <p>Hi ${escapeHtml(greetingName)},</p>
      <p>We tried to charge the card on file for your AutoMate subscription and the payment was declined.</p>
      <p>
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#111; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none;">
          Update payment method
        </a>
      </p>
      <p style="color:#666; font-size:13px;">If you think this was an error, reply to this email and we'll take a look.</p>
      <p style="color:#666; font-size:13px;">— The AutoMate team</p>
    </div>
  `;

  return { subject, html, text };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
