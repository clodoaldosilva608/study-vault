'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/app-store';
import { AuthScreen } from '@/components/screens/auth-screen';
import { DashboardShell } from '@/components/dashboard/shell';
import { BootScreen } from '@/components/screens/boot-screen';
import { ErrorBoundary } from '@/components/common/error-boundary';

export default function Home() {
  const loading = useAppStore((s) => s.loading);
  const user = useAppStore((s) => s.user);
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <ErrorBoundary>
      {loading ? (
        <BootScreen />
      ) : !user ? (
        <AuthScreen />
      ) : (
        <DashboardShell />
      )}
    </ErrorBoundary>
  );
}
