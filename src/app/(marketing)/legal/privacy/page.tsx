import { buildMetadata } from '@/lib/seo/metadata';
import { LegalShell } from '@/components/marketing/legal-shell';

export const metadata = buildMetadata({
  title: 'Privacy Policy · AutoMate',
  description: 'How AutoMate collects, uses, and protects your data.',
  path: '/legal/privacy',
  noIndex: true,
});

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="January 1, 2026">
      <h2>1. Information We Collect</h2>
      <p>
        We collect the minimum needed to run the Service:
      </p>
      <ul>
        <li>
          <strong>Account info</strong> — your email address and display name
          from the OAuth provider you sign in with.
        </li>
        <li>
          <strong>Integration tokens</strong> — OAuth access and refresh
          tokens for the third-party accounts you connect (Gmail, Drive,
          Slack, Notion, Calendar).
        </li>
        <li>
          <strong>Workflow definitions</strong> — the workflows you create,
          including the prompts you type and the AI-generated structure.
        </li>
        <li>
          <strong>Run history</strong> — execution timestamps, step results,
          and any error messages. Run history is retained according to your
          plan (see the Pricing page).
        </li>
        <li>
          <strong>Billing info</strong> — handled by Stripe; we never see your
          full card number.
        </li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>
        We use your data only to operate the Service: authenticate you, run
        your workflows, bill correctly, surface errors, and improve
        reliability. We do not sell your data, share it with advertisers, or
        train AI models on it.
      </p>

      <h2>3. Data Security</h2>
      <ul>
        <li>
          OAuth tokens are encrypted at rest using AES-256-GCM with a
          server-side encryption key. Tokens are decrypted only in memory
          while a workflow step is running.
        </li>
        <li>
          Inbound queue callbacks are signed with HMAC and verified before
          any handler logic runs.
        </li>
        <li>
          All traffic uses TLS. The application runs on Vercel; data lives in
          MongoDB Atlas.
        </li>
      </ul>

      <h2>4. Data Sharing</h2>
      <p>
        We share data only with the third-party services required to provide
        the functionality you request:
      </p>
      <ul>
        <li>
          <strong>Google, Slack, Notion</strong> — for the integrations you
          connect, scoped to the permissions you grant.
        </li>
        <li>
          <strong>Anthropic / OpenRouter</strong> — for the AI workflow
          builder and AI transform steps. Prompts you type are sent to the
          model provider.
        </li>
        <li>
          <strong>Stripe</strong> — for subscription billing and metered
          overage.
        </li>
        <li>
          <strong>Upstash QStash</strong> — for scheduling and execution
          queueing. Only metadata (workflow id, run id) is sent; we don't
          ship raw integration data through the queue.
        </li>
      </ul>

      <h2>5. Data Retention &amp; Deletion</h2>
      <p>
        You can delete a workflow from the dashboard at any time, which
        immediately purges its definition. Deleting your account purges your
        OAuth tokens, integrations, and workflow definitions. Run history is
        retained for the length of your plan's retention window for
        debugging.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use session cookies for authentication. We do not use third-party
        advertising cookies.
      </p>

      <h2>7. Children</h2>
      <p>
        The Service is not directed to children under 13. If you believe a
        child has provided us personal information, contact us and we will
        delete it.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update this policy. Material changes will be announced via
        email or in-product notice.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about your data? Reach out via the email address listed in
        our profile.
      </p>
    </LegalShell>
  );
}
