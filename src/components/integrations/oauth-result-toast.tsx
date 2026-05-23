'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  slack: 'Slack',
  notion: 'Notion',
};

/**
 * Reads `?success=...` / `?error=...` query params left by the OAuth
 * callback redirect and surfaces them as toasts. Strips the params from the
 * URL afterward so reloading the page doesn't re-fire the toast.
 */
export function OAuthResultToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const success = searchParams.get('success');
    const errorMessage = searchParams.get('error');
    if (!success && !errorMessage) return;
    firedRef.current = true;

    if (success) {
      const label = PROVIDER_LABELS[success] ?? success;
      toast.success(`${label} connected`);
    } else if (errorMessage) {
      toast.error(errorMessage);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('success');
    params.delete('error');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
