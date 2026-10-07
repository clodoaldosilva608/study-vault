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
  X,
} from 'lucide-react';
import { useAppStore, type ViewKey } from '@/lib/store/app-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SimpleSheet } from '@/components/common/simple-dialog';
import { cn } from '@/lib/utils';

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'knowledge' | 'admin';
};

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { key: 'files', label: 'Arquivos', icon: FolderTree, group: 'main' },
  { key: 'favorites', label: 'Favoritos', icon: Star, group: 'main' },
  { key: 'recent', label: 'Recentes', icon: Clock, group: 'main' },
  { key: 'search', label: 'Buscar', icon: Search, group: 'main' },
  { key: 'trash', label: 'Lixeira', icon: Trash2, group: 'main' },
  { key: 'notes', label: 'Notas', icon: StickyNote, group: 'knowledge' },
  { key: 'obsidian', label: 'Obsidian', icon: FileText, group: 'knowledge' },
  { key: 'audit', label: 'Auditoria', icon: ShieldAlert, group: 'admin' },
  { key: 'jarvis', label: 'JARVIS', icon: Bot, group: 'admin' },
  { key: 'settings', label: 'Configurações', icon: Settings, group: 'admin' },
];

const GROUPS: { key: NavItem['group']; label: string }[] = [
  { key: 'main', label: 'Workspace' },
  { key: 'knowledge', label: 'Conhecimento' },
  { key: 'admin', label: 'Administração' },
];

/** Reusable nav content — used both in the desktop sidebar and mobile drawer. */
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return (
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
                onClick={() => {
                  setView(item.key);
                  onNavigate?.();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors min-h-[44px]',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'text-primary')} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Reusable user footer — used in both desktop and mobile. */
function UserFooter() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  return (
    <div className="border-t border-sidebar-border p-3 flex items-center gap-3">
      <Avatar className="h-9 w-9 shrink-0">
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
        aria-label="Sair"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Brand header — reused in both desktop and mobile. */
function BrandHeader({ onClose }: { onClose?: () => void }) {
  const workspace = useAppStore((s) => s.workspace);
  return (
    <div className="h-16 px-5 flex items-center gap-3 border-b border-sidebar-border">
      <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/25 shrink-0">
        <Vault className="h-4.5 w-4.5 text-primary" />
      </div>
      <div className="flex flex-col leading-tight min-w-0 flex-1">
        <span className="text-sm font-semibold truncate">Study Vault</span>
        <span className="text-[11px] text-muted-foreground truncate">
          {workspace?.name ?? 'Carregando…'}
        </span>
      </div>
      {onClose && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Fechar menu"
          className="h-8 w-8 shrink-0 md:hidden text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Desktop sidebar — hidden on mobile (< md). */
export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <BrandHeader />
      <NavContent />
      <UserFooter />
    </aside>
  );
}

/** Mobile drawer — opens when sidebarOpen is true, slides from left. */
export function MobileSidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <SimpleSheet open={sidebarOpen} onOpenChange={setSidebarOpen} side="left">
      <BrandHeader onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        <NavContent onNavigate={() => setSidebarOpen(false)} />
      </div>
      <UserFooter />
    </SimpleSheet>
  );
}
