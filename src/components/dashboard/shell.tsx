'use client';

import { useAppStore, type ViewKey } from '@/lib/store/app-store';
import { Sidebar, MobileSidebar } from './sidebar';
import { TopBar } from './topbar';
import { DashboardView } from '@/components/views/dashboard-view';
import { FilesView } from '@/components/views/files-view';
import { FavoritesView } from '@/components/views/favorites-view';
import { RecentView } from '@/components/views/recent-view';
import { TrashView } from '@/components/views/trash-view';
import { SearchView } from '@/components/views/search-view';
import { NotesView } from '@/components/views/notes-view';
import { ObsidianView } from '@/components/views/obsidian-view';
import { AuditView } from '@/components/views/audit-view';
import { JarvisView } from '@/components/views/jarvis-view';
import { SettingsView } from '@/components/views/settings-view';
import { ErrorBoundary } from '@/components/common/error-boundary';

function ViewErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-destructive">Erro ao carregar esta página</h2>
        <p className="text-xs text-muted-foreground">
          Ocorreu um erro ao renderizar esta seção. Você pode tentar novamente
          ou voltar ao dashboard.
        </p>
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            Detalhes do erro
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
          >
            Recarregar página
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary fallback={(err, reset) => <ViewErrorFallback error={err} reset={reset} />}>
            {view === 'dashboard' && <DashboardView />}
            {view === 'files' && <FilesView />}
            {view === 'favorites' && <FavoritesView />}
            {view === 'recent' && <RecentView />}
            {view === 'trash' && <TrashView />}
            {view === 'search' && <SearchView />}
            {view === 'notes' && <NotesView />}
            {view === 'obsidian' && <ObsidianView />}
            {view === 'audit' && <AuditView />}
            {view === 'jarvis' && <JarvisView />}
            {view === 'settings' && <SettingsView />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export type { ViewKey };
