'use client';

import {
  LayoutDashboard,
  FolderTree,
  Star,
  Clock,
  Trash2,
  Search,
  StickyNote,
  FileText,
  ShieldAlert,
  Bot,
  Settings,
  Vault,
  LogOut,
} from 'lucide-react';
import { useAppStore, type ViewKey } from '@/lib/store/app-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'knowledge' | 'admin';
};

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { key: 'files', label: 'Files', icon: FolderTree, group: 'main' },
  { key: 'favorites', label: 'Favorites', icon: Star, group: 'main' },
  { key: 'recent', label: 'Recent', icon: Clock, group: 'main' },
  { key: 'search', label: 'Search', icon: Search, group: 'main' },
  { key: 'trash', label: 'Trash', icon: Trash2, group: 'main' },
  { key: 'notes', label: 'Notes', icon: StickyNote, group: 'knowledge' },
  { key: 'obsidian', label: 'Obsidian', icon: FileText, group: 'knowledge' },
  { key: 'audit', label: 'Audit log', icon: ShieldAlert, group: 'admin' },
  { key: 'jarvis', label: 'JARVIS tools', icon: Bot, group: 'admin' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'admin' },
];

const GROUPS: { key: NavItem['group']; label: string }[] = [
  { key: 'main', label: 'Workspace' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'admin', label: 'Administration' },
];

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);
  const workspace = useAppStore((s) => s.workspace);
  const logout = useAppStore((s) => s.logout);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/25">
          <Vault className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-semibold truncate">Study Vault</span>
          <span className="text-[11px] text-muted-foreground truncate">
            {workspace?.name ?? 'Loading…'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {GROUPS.map((g) => (
          <div key={g.key} className="space-y-1">
            <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground/80 mb-2">
              {g.label}
            </p>
            {NAV.filter((n) => n.group === g.key).map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
            {(user?.name?.[0] || user?.email[0] || '?').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {user?.name || 'User'}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {user?.email}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={logout}
          aria-label="Sign out"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
