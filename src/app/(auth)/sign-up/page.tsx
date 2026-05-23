import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';
import { AuthBranding } from '@/components/auth/auth-branding';
import { authErrorMessage } from '@/lib/auth/error-messages';

export const metadata: Metadata = {
  title: 'Create your account',
};

interface SignUpPageProps {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { callbackUrl, error } = await searchParams;
  const authError = authErrorMessage(error);

  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <AuthBranding className="hidden lg:flex" reverse />
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-md">
          {authError ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">{authError.title}</p>
              <p className="mt-0.5 text-destructive/80">{authError.description}</p>
            </div>
          ) : null}
          <Suspense fallback={null}>
            <SignInForm mode="sign-up" callbackUrl={callbackUrl ?? '/dashboard'} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
