'use client';

import { useEffect, useState } from 'react';
import {
  SimpleDialog,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogBody,
  SimpleDialogFooter,
  SimpleDialogClose,
} from '@/components/common/simple-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Loader2 } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';
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
      toast.success(`Pasta "${name.trim()}" criada`);
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
    <SimpleDialog open={open} onOpenChange={onOpenChange}>
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" />
          <SimpleDialogTitle>Criar pasta</SimpleDialogTitle>
        </div>
      </SimpleDialogHeader>
      <form onSubmit={handleCreate}>
        <SimpleDialogBody>
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Nome</Label>
            <Input
              id="folder-name"
              placeholder="Ex: Direito Constitucional"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground">
              {parentId ? 'Subpasta da pasta atual.' : 'Pasta raiz do workspace.'}
            </p>
          </div>
        </SimpleDialogBody>
        <SimpleDialogFooter>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !name.trim()} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar
          </Button>
        </SimpleDialogFooter>
      </form>
    </SimpleDialog>
  );
}

export function RenameDialog({
  open,
  onOpenChange,
  initialName,
  onConfirm,
  title = 'Renomear',
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
    <SimpleDialog open={open} onOpenChange={onOpenChange}>
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <SimpleDialogTitle>{title}</SimpleDialogTitle>
      </SimpleDialogHeader>
      <form onSubmit={handleConfirm}>
        <SimpleDialogBody>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            maxLength={200}
          />
        </SimpleDialogBody>
        <SimpleDialogFooter>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !name.trim()} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SimpleDialogFooter>
      </form>
    </SimpleDialog>
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
    <SimpleDialog open={open} onOpenChange={onOpenChange}>
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <SimpleDialogTitle>Mover para pasta</SimpleDialogTitle>
      </SimpleDialogHeader>
      <SimpleDialogBody>
        <p className="text-xs text-muted-foreground mb-3">Selecione a pasta de destino.</p>
        <div className="max-h-80 overflow-y-auto space-y-1">
          <button
            onClick={() => setSelected(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
              selected === null ? 'border-primary bg-primary/8' : 'border-border hover:bg-accent/50'
            }`}
          >
            Raiz (sem pasta)
          </button>
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Carregando…</div>
          ) : folders.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma pasta encontrada.</div>
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
      </SimpleDialogBody>
      <SimpleDialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={moving}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={moving} className="gap-2">
          {moving && <Loader2 className="h-4 w-4 animate-spin" />}
          Mover
        </Button>
      </SimpleDialogFooter>
    </SimpleDialog>
  );
}
