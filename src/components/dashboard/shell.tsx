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

export function DashboardShell() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
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
        </main>
      </div>
    </div>
  );
}

export type { ViewKey };
