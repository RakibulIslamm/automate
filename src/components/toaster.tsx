'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme === 'light' || resolvedTheme === 'dark' ? resolvedTheme : 'dark') as
    | 'light'
    | 'dark';

  return (
    <SonnerToaster
      position="top-right"
      theme={theme}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
        },
      }}
    />
  );
}
