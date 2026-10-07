'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/common/error-boundary';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // Unregister any existing service workers on mount.
  // The SW was removed but old registrations may persist in user browsers.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          reg.unregister();
          console.log('[sw] unregistered old service worker');
        }
      })
      .catch(() => null);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
        suppressHydrationWarning
      >
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
