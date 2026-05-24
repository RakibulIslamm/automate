import { buildMetadata } from '@/lib/seo/metadata';
import { LegalShell } from '@/components/marketing/legal-shell';

export const metadata = buildMetadata({
  title: 'Terms of Service · AutoMate',
  description: 'AutoMate Terms of Service.',
  path: '/legal/terms',
  noIndex: true,
});

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" lastUpdated="January 1, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using AutoMate (the "Service"), you agree to be bound by
        these Terms of Service. If you do not agree to all the terms, do not
        use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        AutoMate is a workflow-automation platform that builds and executes
        workflows on your behalf using third-party integrations you authorize
        (Gmail, Google Drive, Google Calendar, Slack, Notion, and others added
        from time to time).
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 18 years old to use the Service. By using the
        Service, you represent that you meet this requirement and that you are
        authorized to grant access to the third-party accounts you connect.
      </p>

      <h2>4. Account &amp; Security</h2>
      <p>
        You are responsible for safeguarding your sign-in credentials. Notify
        us immediately of any unauthorized access. We may suspend or terminate
        accounts that violate these Terms.
      </p>

      <h2>5. Subscriptions &amp; Billing</h2>
      <p>
        Paid plans are billed monthly via Stripe. Run quotas and overage rates
        are described on the Pricing page. You may cancel at any time; access
        continues until the end of the current billing period.
      </p>

      <h2>6. Acceptable Use</h2>
      <p>
        You may not use the Service to (a) send unsolicited messages, (b)
        violate any applicable law, (c) infringe third-party rights, (d)
        interfere with the Service's operation, or (e) circumvent usage
        limits.
      </p>

      <h2>7. Third-Party Services</h2>
      <p>
        The Service depends on third-party APIs (Google, Slack, Notion, Stripe,
        Upstash, Anthropic, OpenRouter, and others). Their outages, changes,
        or terms may affect what AutoMate can do for you. We are not
        responsible for third-party service availability.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        We retain ownership of the Service and its underlying technology. You
        retain ownership of the content you submit to the Service. You grant
        us a limited license to process that content as necessary to operate
        the Service.
      </p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER
        EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, AUTOMATE SHALL NOT BE LIABLE
        FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL
        LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE SHALL NOT EXCEED THE
        AMOUNTS YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
      </p>

      <h2>11. Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time
        for violation of these Terms. You may stop using the Service at any
        time.
      </p>

      <h2>12. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        announced via email or in-product notice. Continued use after the
        effective date constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Reach out via the email address listed in
        our profile.
      </p>
    </LegalShell>
  );
}
