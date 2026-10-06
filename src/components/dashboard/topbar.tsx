'use client';

import { useAppStore, type ViewKey } from '@/lib/store/app-store';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

const TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral do seu workspace' },
  files: { title: 'Arquivos', subtitle: 'Navegue e gerencie pastas e arquivos' },
  favorites: { title: 'Favoritos', subtitle: 'Arquivos marcados como favorito' },
  recent: { title: 'Recentes', subtitle: 'Arquivos acessados recentemente' },
  trash: { title: 'Lixeira', subtitle: 'Arquivos excluídos — restaurar ou excluir definitivamente' },
  search: { title: 'Buscar', subtitle: 'Encontre arquivos no seu workspace' },
  notes: { title: 'Notas', subtitle: 'Notas em Markdown' },
  obsidian: { title: 'Obsidian', subtitle: 'Importar / exportar Markdown do seu vault' },
  audit: { title: 'Auditoria', subtitle: 'Cada operação sensível registrada' },
  jarvis: { title: 'JARVIS', subtitle: 'Credenciais de agente e ferramentas' },
  settings: { title: 'Configurações', subtitle: 'Configuração do workspace' },
};

export function TopBar() {
  const view = useAppStore((s) => s.view);
  const meta = TITLES[view];
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const goBack = useAppStore((s) => s.goBack);
  const canGoBack = useAppStore((s) => s.canGoBack());

  useEffect(() => setMounted(true), []);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
      {/* Left: hamburger (mobile) + back button + title */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Hamburger — mobile only */}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Abrir menu"
          onClick={() => setSidebarOpen(true)}
          className="h-9 w-9 shrink-0 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Back button — visible when there's history */}
        {canGoBack && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Voltar"
            onClick={goBack}
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="min-w-0">
          <h1 className="text-base lg:text-lg font-semibold tracking-tight truncate">
            {meta.title}
          </h1>
          <p className="text-[12px] text-muted-foreground truncate hidden sm:block">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: theme toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Alternar tema"
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
