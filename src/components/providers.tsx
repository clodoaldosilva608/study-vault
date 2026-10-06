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

  // Register service worker that UNREGISTERS itself to clear stale caches.
  // This runs once on mount in production only.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const unregisterOld = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
          console.log('[sw] unregistered old service worker');
        }
      } catch (err) {
        console.warn('[sw] unregister failed', err);
      }
    };

    // Register the self-unregistering SW (clears old caches)
    navigator.serviceWorker
      .register('/sw.js?v=cleanup', { scope: '/' })
      .then(() => {
        // After registration, the SW will self-unregister on activate.
        // Also manually unregister after a short delay.
        setTimeout(unregisterOld, 1000);
      })
      .catch((err) => console.warn('[sw] register failed', err));
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
