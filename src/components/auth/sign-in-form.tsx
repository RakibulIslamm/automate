'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { authErrorMessage } from '@/lib/auth/error-messages';

const emailSchema = z.object({
  email: z.email('Enter a valid email address'),
});

type EmailValues = z.infer<typeof emailSchema>;

export interface SignInFormProps {
  callbackUrl?: string;
  mode?: 'sign-in' | 'sign-up';
}

export function SignInForm({ callbackUrl = '/dashboard', mode = 'sign-in' }: SignInFormProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, startEmailTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<EmailValues>({
    resolver: standardSchemaResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const handleGoogle = () => {
    setGoogleLoading(true);
    void signIn('google', { callbackUrl, redirect: true }).catch((err: unknown) => {
      setGoogleLoading(false);
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      toast.error('Sign-in failed', { description: message });
    });
  };

  const handleEmail = form.handleSubmit((values) => {
    startEmailTransition(async () => {
      try {
        const result = await signIn('resend', {
          email: values.email,
          callbackUrl,
          redirect: false,
        });
        // signIn() returns { ok, error, status, url } with redirect:false.
        // `error` is parsed from `?error=…` on the returned URL when Auth.js
        // routes the response through its error page.
        if (!result?.ok || result.error) {
          const friendly = authErrorMessage(result?.error);
          toast.error(friendly?.title ?? 'Could not send link', {
            description: friendly?.description ?? 'Please try again or use Google.',
          });
          return;
        }
        setSentTo(values.email);
        toast.success('Check your email', {
          description: `We sent a sign-in link to ${values.email}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not send the magic link';
        toast.error('Could not send link', { description: message });
      }
    });
  });

  if (sentTo) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto inline-flex rounded-full bg-primary/10 p-3 text-primary">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="mt-4 font-serif text-2xl tracking-tight">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>.
          Click the link in the email to finish signing in.
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  const isSignUp = mode === 'sign-up';

  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
          {isSignUp ? 'Create your AutoMate account' : 'Sign in to AutoMate'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignUp
            ? 'Get started in seconds — describe an automation in plain English and AutoMate runs it.'
            : 'Welcome back. Continue with Google or have a magic link sent to your inbox.'}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-6 w-full"
        onClick={handleGoogle}
        disabled={googleLoading || emailLoading}
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={emailLoading}
            aria-invalid={!!form.formState.errors.email || undefined}
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className={cn('text-xs text-destructive')} role="alert">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={emailLoading || googleLoading}>
          {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Send magic link
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
        <p>
          {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
          <a
            href={isSignUp ? '/sign-in' : '/sign-up'}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Create account'}
          </a>
        </p>
        <p className="text-xs">
          By {isSignUp ? 'creating an account' : 'signing in'}, you agree to our{' '}
          <a href="/legal/terms" className="underline-offset-4 hover:underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="/legal/privacy" className="underline-offset-4 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.741 2.982-4.305 2.982-7.351Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.759-5.596-4.123H3.064v2.59A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9a5.996 5.996 0 0 1 0-3.8V7.51H3.064a9.996 9.996 0 0 0 0 8.98l3.34-2.59Z"
        fill="#FBBC04"
      />
      <path
        d="M12 5.977c1.469 0 2.787.505 3.823 1.496l2.868-2.868C16.96 3.05 14.696 2 12 2A9.996 9.996 0 0 0 3.064 7.51l3.34 2.59C7.19 7.736 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  );
}
