'use client';

import { useAppStore, type ViewKey } from '@/lib/store/app-store';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';

const TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your workspace activity' },
  files: { title: 'Files', subtitle: 'Browse and manage folders and files' },
  favorites: { title: 'Favorites', subtitle: 'Files you marked as favorite' },
  recent: { title: 'Recent', subtitle: 'Recently accessed files' },
  trash: { title: 'Trash', subtitle: 'Soft-deleted files — restore or purge' },
  search: { title: 'Search', subtitle: 'Find files across your workspace' },
  notes: { title: 'Notes', subtitle: 'Markdown notes' },
  obsidian: { title: 'Obsidian', subtitle: 'Import / export Markdown with your vault' },
  audit: { title: 'Audit log', subtitle: 'Every sensitive operation, recorded' },
  jarvis: { title: 'JARVIS tools', subtitle: 'Agent credentials and tool registry' },
  settings: { title: 'Settings', subtitle: 'Workspace configuration' },
};

export function TopBar() {
  const view = useAppStore((s) => s.view);
  const meta = TITLES[view];
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-base lg:text-lg font-semibold tracking-tight truncate">
          {meta.title}
        </h1>
        <p className="text-[12px] text-muted-foreground truncate hidden sm:block">
          {meta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
