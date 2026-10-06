'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api/client';

// Re-export UploadDialog so views can import all file dialogs from one module.
export { UploadDialog } from '@/components/files/upload-dialog';

type FolderItem = {
  id: string;
  name: string;
  path: string;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parentId: string | null;
  onCreated?: () => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/v1/folders', {
        name: name.trim(),
        parentId: parentId ?? null,
      });
      toast.success(`Folder "${name.trim()}" created`);
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create folder';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" /> Create folder
          </DialogTitle>
          <DialogDescription>
            {parentId ? 'Sub-folder of the current location.' : 'Top-level folder in workspace.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g. Direito Constitucional"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({
  open,
  onOpenChange,
  initialName,
  onConfirm,
  title = 'Rename',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialName: string;
  onConfirm: (name: string) => Promise<void>;
  title?: string;
}) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onConfirm(name.trim());
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConfirm} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            maxLength={200}
          />
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveDialog({
  open,
  onOpenChange,
  onConfirm,
  excludeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (folderId: string | null) => Promise<void>;
  excludeId?: string;
}) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ items: FolderItem[] }>('/api/v1/folders?pageSize=100')
      .then((r) => setFolders(r.items.filter((f) => f.id !== excludeId)))
      .finally(() => setLoading(false));
  }, [open, excludeId]);

  async function handleConfirm() {
    setMoving(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Move failed';
      toast.error(msg);
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          <button
            onClick={() => setSelected(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
              selected === null ? 'border-primary bg-primary/8' : 'border-border hover:bg-accent/50'
            }`}
          >
            Root (no folder)
          </button>
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : folders.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No folders yet.</div>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
                  selected === f.id ? 'border-primary bg-primary/8' : 'border-border hover:bg-accent/50'
                }`}
              >
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{f.path}</div>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={moving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={moving} className="gap-2">
            {moving && <Loader2 className="h-4 w-4 animate-spin" />}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
