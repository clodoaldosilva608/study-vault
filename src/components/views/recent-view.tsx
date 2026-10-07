'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Download, Loader2 } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';

type RecentItem = {
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
};

export function RecentView() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: RecentItem[]; total: number }>('/api/v1/recent?pageSize=50')
      .then((r) => setItems(r.items))
      .catch(() => toast.error('Failed to load recent files'))
      .finally(() => setLoading(false));
  }, []);

  async function download(fileId: string, name: string) {
    try {
      const res = await fetch(`/api/v1/files/${fileId}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">
          Last 50 accessed files in this workspace
        </span>
      </div>
      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">No recent activity</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Files you open or download will appear here.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => download(r.file.id, r.file.name)}
                aria-label="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
