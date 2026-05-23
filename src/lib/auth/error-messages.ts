/**
 * Map Auth.js error codes (the `?error=…` param on redirects from
 * `/api/auth/*`) to user-friendly copy. Anything unknown falls back to a
 * generic "Sign-in failed" message so we never leak Auth.js internals.
 */
export interface AuthErrorMessage {
  title: string;
  description: string;
}

const KNOWN: Record<string, AuthErrorMessage> = {
  Configuration: {
    title: 'Sign-in is misconfigured',
    description:
      "We couldn't send the magic link — the email service isn't set up. Try Google instead, or contact support.",
  },
  AccessDenied: {
    title: 'Access denied',
    description: "You don't have permission to sign in. Please contact support.",
  },
  Verification: {
    title: 'Link expired',
    description:
      'That sign-in link is no longer valid. Request a new one — links expire after 24 hours.',
  },
  OAuthAccountNotLinked: {
    title: 'Different sign-in method',
    description:
      'This email is already linked to a different sign-in method. Try the one you used originally.',
  },
  OAuthSignin: {
    title: 'Google sign-in failed',
    description: 'We couldn’t start the Google sign-in. Please try again.',
  },
  OAuthCallback: {
    title: 'Google sign-in failed',
    description: 'Google didn’t return a valid response. Please try again.',
  },
  EmailSignin: {
    title: 'Could not send link',
    description: 'We couldn’t send the magic link. Please try again or use Google.',
  },
  Callback: {
    title: 'Sign-in callback failed',
    description: 'Something went wrong finishing sign-in. Please try again.',
  },
};

const FALLBACK: AuthErrorMessage = {
  title: 'Sign-in failed',
  description: 'Please try again. If the problem keeps happening, contact support.',
};

export function authErrorMessage(code: string | undefined | null): AuthErrorMessage | null {
  if (!code) return null;
  return KNOWN[code] ?? FALLBACK;
}
