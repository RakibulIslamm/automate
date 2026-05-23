'use client';

import { IntegrationCard, type ExistingIntegration } from './integration-card';
import { GoogleIcon } from './google-icon';

// Google expands the short `email`/`profile` aliases into fully-qualified
// userinfo scope URLs in the granted-scopes response, so we map both forms.
const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Read mail',
  'https://www.googleapis.com/auth/gmail.send': 'Send mail',
  'https://www.googleapis.com/auth/gmail.modify': 'Modify mail',
  'https://www.googleapis.com/auth/drive.file': 'Drive files',
  'https://www.googleapis.com/auth/calendar': 'Calendar',
  'https://www.googleapis.com/auth/userinfo.email': 'Email',
  'https://www.googleapis.com/auth/userinfo.profile': 'Profile',
  openid: 'Identity',
  email: 'Email',
  profile: 'Profile',
};

export interface GoogleIntegrationCardProps {
  integration: ExistingIntegration | null;
}

export function GoogleIntegrationCard({ integration }: GoogleIntegrationCardProps) {
  return (
    <IntegrationCard
      provider="google"
      title="Google Workspace"
      shortLabel="Google"
      description="Gmail · Drive · Calendar — one connection, three superpowers."
      icon={<GoogleIcon className="size-7" />}
      features={[
        'Read & send Gmail',
        'Save files to Drive',
        'Create calendar events',
        'Encrypted at rest',
      ]}
      accountLabel="Account"
      scopeLabels={SCOPE_LABELS}
      scopeListLabel="Scopes"
      integration={integration}
    />
  );
}
