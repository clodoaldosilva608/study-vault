'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';

type FileItem = {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  deletedAt: string | null;
  updatedAt: string;
};

export function TrashView() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api
      .get<{ items: FileItem[]; total: number }>('/api/v1/trash?pageSize=100')
      .then((r) => setItems(r.items))
      .catch(() => toast.error('Failed to load trash'))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  async function restore(id: string) {
    try {
      await api.post(`/api/v1/trash/${id}/restore`);
      toast.success('Restored');
      refresh();
    } catch (err) {
      toast.error('Failed to restore');
    }
  }

  async function purge(id: string) {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;
    try {
      await api.delete(`/api/v1/files/${id}?permanent=true`);
      toast.success('Permanently deleted');
      refresh();
    } catch {
      toast.error('Failed to purge');
    }
  }

  async function emptyTrash() {
    if (!confirm('Empty trash? All files will be permanently deleted.')) return;
    try {
      await api.delete('/api/v1/trash?empty=true');
      toast.success('Trash emptied');
      refresh();
    } catch {
      toast.error('Failed to empty trash');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''} in trash
          </span>
        </div>
        {items.length > 0 && (
          <Button variant="destructive" size="sm" onClick={emptyTrash} className="gap-2">
            <Trash2 className="h-3.5 w-3.5" /> Empty trash
          </Button>
        )}
      </div>

      <Card className="p-3 border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Items in trash are soft-deleted. Automatic retention policy will be enabled in a future release.
        </span>
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Trash2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">Trash is empty</h3>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <FileTypeIcon mimeType={f.mimeType} extension={f.extension} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {formatBytes(f.sizeBytes)} · deleted {f.deletedAt ? formatRelative(f.deletedAt) : '—'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => restore(f.id)} className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" /> Restore
              </Button>
              <Button variant="ghost" size="icon" onClick={() => purge(f.id)} aria-label="Delete permanently">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
