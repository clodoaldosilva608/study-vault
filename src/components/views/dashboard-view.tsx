'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/lib/store/app-store';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';
import {
  FolderTree,
  Star,
  Clock,
  ShieldCheck,
  Bot,
  HardDrive,
  ArrowUpRight,
  Upload,
  FileText,
} from 'lucide-react';

type UsageResp = {
  storageUsedBytes: number;
  storageLimitBytes: number;
  filesCount: number;
  foldersCount: number;
  notesCount: number;
};

type RecentResp = {
  items: Array<{
    id: string;
    accessedAt: string;
    file: {
      id: string;
      name: string;
      extension: string;
      mimeType: string;
      sizeBytes: number;
      folder: { id: string; name: string } | null;
    };
  }>;
  total: number;
};

export function DashboardView() {
  const setView = useAppStore((s) => s.setView);
  const workspace = useAppStore((s) => s.workspace);
  const [usage, setUsage] = useState<UsageResp | null>(null);
  const [recent, setRecent] = useState<RecentResp['items']>([]);

  useEffect(() => {
    Promise.all([
      api.get<UsageResp>('/api/v1/workspaces/usage').catch(() => null),
      api.get<RecentResp>('/api/v1/recent?pageSize=5').catch(() => ({ items: [], total: 0 })),
    ]).then(([u, r]) => {
      if (u) setUsage(u);
      if (r) setRecent(r.items);
    });
  }, []);

  const usagePct =
    usage && usage.storageLimitBytes > 0
      ? (usage.storageUsedBytes / usage.storageLimitBytes) * 100
      : 0;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <Card className="relative overflow-hidden p-6 lg:p-8 border-border/60">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute right-32 top-20 h-32 w-32 rounded-full bg-chart-2/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Workspace · {workspace?.plan ?? 'FREE'}
            </p>
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight">
              {workspace?.name ?? 'Your workspace'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Multi-tenant foundation with audit, JARVIS tool layer, and Obsidian
              import/export. Everything below respects workspace isolation.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => setView('files')} variant="outline" className="gap-2">
              <FolderTree className="h-4 w-4" /> Browse files
            </Button>
            <Button onClick={() => setView('jarvis')} className="gap-2">
              <Bot className="h-4 w-4" /> JARVIS tools
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Storage used"
          value={usage ? formatBytes(usage.storageUsedBytes) : '—'}
          icon={<HardDrive className="h-4 w-4" />}
          hint={usage ? `of ${formatBytes(usage.storageLimitBytes)}` : undefined}
        />
        <StatTile
          label="Files"
          value={usage?.filesCount?.toString() ?? '—'}
          icon={<Upload className="h-4 w-4" />}
        />
        <StatTile
          label="Folders"
          value={usage?.foldersCount?.toString() ?? '—'}
          icon={<FolderTree className="h-4 w-4" />}
        />
        <StatTile
          label="Notes"
          value={usage?.notesCount?.toString() ?? '—'}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Storage
          </h3>
          <span className="text-xs text-muted-foreground">
            {usage
              ? `${formatBytes(usage.storageUsedBytes)} / ${formatBytes(usage.storageLimitBytes)}`
              : '—'}
          </span>
        </div>
        <Progress value={usagePct} className="h-2" />
        <p className="text-[11px] text-muted-foreground mt-2">
          Free plan includes 2 GB. Upgrade paths available when SaaS launches.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent files
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setView('recent')} className="gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
          {recent.length === 0 ? (
            <EmptyHint text="Nenhum arquivo acessado recentemente." />
          ) : (
            <ul className="divide-y divide-border">
              {recent.filter((r) => r.file).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <FileTypeIcon mimeType={r.file.mimeType} extension={r.file.extension} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.file.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.file.folder?.name ?? 'Root'} · {formatBytes(r.file.sizeBytes)}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatRelative(r.accessedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold">Quick actions</h3>
          <QuickLink onClick={() => setView('files')} icon={<Upload className="h-4 w-4" />}>
            Upload files
          </QuickLink>
          <QuickLink onClick={() => setView('notes')} icon={<FileText className="h-4 w-4" />}>
            Create a note
          </QuickLink>
          <QuickLink onClick={() => setView('favorites')} icon={<Star className="h-4 w-4" />}>
            View favorites
          </QuickLink>
          <QuickLink onClick={() => setView('obsidian')} icon={<FileText className="h-4 w-4" />}>
            Obsidian import / export
          </QuickLink>
          <QuickLink onClick={() => setView('audit')} icon={<ShieldCheck className="h-4 w-4" />}>
            Review audit log
          </QuickLink>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4 lg:p-5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-xl lg:text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed border-border/70 rounded-md">
      {text}
    </div>
  );
}

function QuickLink({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent/60 hover:text-accent-foreground border border-transparent hover:border-border/60"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
