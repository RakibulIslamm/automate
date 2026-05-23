import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';
import { AuthBranding } from '@/components/auth/auth-branding';

export const metadata: Metadata = {
  title: 'Sign in',
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; status?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl, status } = await searchParams;
  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-md">
          {status === 'error' ? (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              We couldn&apos;t sign you in. Please try again.
            </p>
          ) : null}
          <Suspense fallback={null}>
            <SignInForm mode="sign-in" callbackUrl={callbackUrl ?? '/dashboard'} />
          </Suspense>
        </div>
      </section>
      <AuthBranding className="hidden lg:flex" />
    </main>
  );
}
