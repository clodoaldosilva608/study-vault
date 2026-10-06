'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';
import { useAppStore } from '@/lib/store/app-store';

type FavItem = {
  id: string;
  createdAt: string;
  file: {
    id: string;
    name: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    updatedAt: string;
    folder: { id: string; name: string } | null;
  };
};

export function FavoritesView() {
  const [items, setItems] = useState<FavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const setView = useAppStore((s) => s.setView);

  const refresh = () => {
    setLoading(true);
    api
      .get<{ items: FavItem[] }>('/api/v1/favorites')
      .then((r) => setItems(r.items))
      .catch(() => toast.error('Failed to load favorites'))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  async function remove(id: string) {
    try {
      await api.delete(`/api/v1/favorites?fileId=${id}`);
      toast.success('Removed from favorites');
      refresh();
    } catch (err) {
      toast.error('Failed');
    }
  }

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
        <Star className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-muted-foreground">{items.length} favorites</span>
      </div>
      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">No favorites yet</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Mark files as favorite from the Files view.
          </p>
          <Button variant="outline" size="sm" onClick={() => setView('files')}>
            Browse files
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 first:rounded-t-md last:rounded-b-md">
              <FileTypeIcon mimeType={f.file.mimeType} extension={f.file.extension} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.file.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {f.file.folder?.name ?? 'Root'} · {formatBytes(f.file.sizeBytes)} · {formatRelative(f.file.updatedAt)}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => download(f.file.id, f.file.name)} aria-label="Download">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(f.file.id)} aria-label="Remove favorite">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
