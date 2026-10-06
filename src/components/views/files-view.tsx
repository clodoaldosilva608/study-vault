'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  MoreVertical,
  Download,
  Pencil,
  FolderInput,
  Trash2,
  Star,
  StarOff,
  Home,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';
import {
  UploadDialog,
  CreateFolderDialog,
  RenameDialog,
  MoveDialog,
} from '@/components/files/dialogs';
import { cn } from '@/lib/utils';

type FolderItem = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
};

type FileItem = {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
  deletedAt: string | null;
  folderId: string | null;
  folder?: { id: string; name: string } | null;
  favorites?: { id: string }[];
};

type Breadcrumb = { id: string | null; name: string };

/**
 * Simple dropdown menu — NO portal, NO Radix.
 * Renders inline and closes on outside click.
 */
function SimpleMenu({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        {trigger}
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-popover shadow-md py-1">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-px bg-border my-1" />;
}

/**
 * Simple checkbox — NO Radix, NO portal.
 */
function SimpleCheckbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-label={ariaLabel}
      className={cn(
        'h-4 w-4 rounded border flex items-center justify-center transition-colors',
        checked
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-transparent border-muted-foreground/40',
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}

export function FilesView() {
  const currentFolderId = useAppStore((s) => s.currentFolderId);
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder);
  const selected = useAppStore((s) => s.selectedFileIds);
  const toggleSelect = useAppStore((s) => s.toggleFileSelected);
  const selectMany = useAppStore((s) => s.selectMany);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ type: 'file' | 'folder'; id: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const folderParams = new URLSearchParams();
      if (currentFolderId) folderParams.set('parentId', currentFolderId);
      else folderParams.set('parentId', 'null');

      const fileParams = new URLSearchParams();
      if (currentFolderId) fileParams.set('folderId', currentFolderId);
      else fileParams.set('folderId', 'null');

      const [fResp, fileResp] = await Promise.all([
        api.get<{ items: FolderItem[]; total: number }>(`/api/v1/folders?${folderParams.toString()}`),
        api.get<{ items: FileItem[]; total: number }>(`/api/v1/files?${fileParams.toString()}`),
      ]);

      setFolders(fResp.items);
      setFiles(fileResp.items);
      await refreshBreadcrumbs(currentFolderId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  const refreshBreadcrumbs = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: 'Root' }]);
      return;
    }
    try {
      const f = await api.get<FolderItem & { parent: FolderItem | null }>(`/api/v1/folders/${folderId}`);
      const chain: Breadcrumb[] = [];
      let cur: (FolderItem & { parent: FolderItem | null }) | null = f;
      while (cur) {
        chain.unshift({ id: cur.id, name: cur.name });
        cur = (cur.parent as any) ?? null;
      }
      chain.unshift({ id: null, name: 'Root' });
      setBreadcrumbs(chain);
    } catch {
      setBreadcrumbs([{ id: null, name: 'Root' }]);
    }
  }, []);

  useEffect(() => {
    refresh();
    clearSelection();
  }, [refresh, clearSelection]);

  const handleDelete = useCallback(async (file: FileItem) => {
    if (!confirm(`Delete "${file.name}"? It will be moved to trash.`)) return;
    try {
      await api.delete(`/api/v1/files/${file.id}`);
      toast.success('Moved to trash');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    }
  }, [refresh]);

  const handleDeleteFolder = useCallback(async (folder: FolderItem) => {
    if (!confirm(`Delete folder "${folder.name}" and all its contents? They go to trash.`)) return;
    try {
      await api.delete(`/api/v1/folders/${folder.id}`);
      toast.success('Folder moved to trash');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    }
  }, [refresh]);

  const toggleFavorite = useCallback(async (file: FileItem) => {
    const isFav = (file.favorites?.length ?? 0) > 0;
    try {
      if (isFav) {
        await api.delete(`/api/v1/favorites?fileId=${file.id}`);
        toast.success('Removed from favorites');
      } else {
        await api.post('/api/v1/favorites', { fileId: file.id });
        toast.success('Added to favorites');
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    }
  }, [refresh]);

  const handleDownload = useCallback(async (file: FileItem) => {
    try {
      const res = await fetch(`/api/v1/files/${file.id}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  }, [refresh]);

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected file(s)? They go to trash.`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        await api.delete(`/api/v1/files/${id}`);
        ok++;
      } catch { /* ignore */ }
    }
    toast.success(`${ok} file(s) moved to trash`);
    clearSelection();
    refresh();
  }, [selected, clearSelection, refresh]);

  // Drag & drop
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggingFileIds, setDraggingFileIds] = useState<Set<string>>(new Set());

  const onFileDragStart = useCallback((e: React.DragEvent, id: string) => {
    const ids = selected.size > 0 && selected.has(id) ? Array.from(selected) : [id];
    e.dataTransfer.setData('application/x-study-vault-files', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingFileIds(new Set(ids));
  }, [selected]);

  const onFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    if (e.dataTransfer.types.includes('application/x-study-vault-files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolderId(folderId);
    }
  }, []);

  const onFolderDrop = useCallback(async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const raw = e.dataTransfer.getData('application/x-study-vault-files');
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    let ok = 0;
    for (const id of ids) {
      try {
        await api.patch(`/api/v1/files/${id}`, { folderId: targetFolderId });
        ok++;
      } catch { /* ignore */ }
    }
    setDraggingFileIds(new Set());
    toast.success(`${ok} file(s) moved`);
    refresh();
  }, [refresh]);

  const allSelected = files.length > 0 && files.every((f) => selected.has(f.id));

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumbs.map((b, i) => (
            <span key={`${b.id ?? 'root'}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/60" />}
              <button
                onClick={() => setCurrentFolder(b.id)}
                className={cn(
                  'hover:text-foreground transition-colors px-1.5 py-0.5 rounded',
                  i === breadcrumbs.length - 1 && 'text-foreground font-medium',
                )}
              >
                {i === 0 && <Home className="inline h-3 w-3 mr-1" />}
                {b.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              Excluir {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)} className="gap-2">
            <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
            <Upload className="h-3.5 w-3.5" /> Enviar
          </Button>
        </div>
      </div>

      {/* Select-all row */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SimpleCheckbox
            checked={allSelected}
            onChange={() => {
              if (allSelected) clearSelection();
              else selectMany(files.map((f) => f.id));
            }}
            ariaLabel="Selecionar tudo"
          />
          <span>
            {files.length} arquivo{files.length !== 1 ? 's' : ''} · {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Folder + file grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">Esta pasta está vazia</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Envie um arquivo ou crie uma subpasta para começar.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)} className="gap-2">
              <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
            </Button>
            <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setCurrentFolder(folder.id)}
              onDragOver={(e) => onFolderDragOver(e, folder.id)}
              onDragLeave={() => setDragOverFolderId((cur) => (cur === folder.id ? null : cur))}
              onDrop={(e) => onFolderDrop(e, folder.id)}
              className={cn(
                'group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent/40 hover:border-border/80 transition-colors text-center min-h-[100px]',
                dragOverFolderId === folder.id
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/8'
                  : 'border-border/60',
              )}
            >
              <Folder className="h-8 w-8 text-primary/80 group-hover:text-primary transition-colors" />
              <div className="w-full">
                <div className="text-xs font-medium truncate">{folder.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {folder.path || '/'}
                </div>
              </div>
              <SimpleMenu
                trigger={
                  <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background cursor-pointer">
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                }
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Renomear"
                      onClick={() => { setRenameTarget({ type: 'folder', id: folder.id, name: folder.name }); close(); }}
                    />
                    <MenuItem
                      icon={<FolderInput className="h-3.5 w-3.5" />}
                      label="Mover"
                      onClick={() => { setMoveTarget({ type: 'folder', id: folder.id }); close(); }}
                    />
                    <MenuSeparator />
                    <MenuItem
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      label="Excluir"
                      destructive
                      onClick={() => { handleDeleteFolder(folder); close(); }}
                    />
                  </>
                )}
              </SimpleMenu>
            </button>
          ))}

          {files.map((file) => {
            const isFav = (file.favorites?.length ?? 0) > 0;
            const isSel = selected.has(file.id);
            const isDragging = draggingFileIds.has(file.id);
            return (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => onFileDragStart(e, file.id)}
                onDragEnd={() => setDraggingFileIds(new Set())}
                onClick={() => toggleSelect(file.id)}
                className={cn(
                  'group relative flex flex-col gap-2 p-3 rounded-xl border bg-card hover:bg-accent/30 hover:border-border/80 transition-all cursor-pointer min-h-[100px]',
                  isSel ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/60',
                  isDragging && 'opacity-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <FileTypeIcon mimeType={file.mimeType} extension={file.extension} className="h-6 w-6" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }}
                      className="p-1 rounded hover:bg-background/80"
                      aria-label={isFav ? 'Remover favorito' : 'Adicionar favorito'}
                    >
                      {isFav ? (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                    <SimpleMenu
                      trigger={
                        <span className="p-1 rounded hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      }
                    >
                      {(close) => (
                        <>
                          <MenuItem
                            icon={<Download className="h-3.5 w-3.5" />}
                            label="Baixar"
                            onClick={() => { handleDownload(file); close(); }}
                          />
                          <MenuItem
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            label="Renomear"
                            onClick={() => { setRenameTarget({ type: 'file', id: file.id, name: file.name }); close(); }}
                          />
                          <MenuItem
                            icon={<FolderInput className="h-3.5 w-3.5" />}
                            label="Mover"
                            onClick={() => { setMoveTarget({ type: 'file', id: file.id }); close(); }}
                          />
                          <MenuSeparator />
                          <MenuItem
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            label="Excluir"
                            destructive
                            onClick={() => { handleDelete(file); close(); }}
                          />
                        </>
                      )}
                    </SimpleMenu>
                  </div>
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="text-xs font-medium leading-tight line-clamp-2 break-all">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span className="opacity-50">·</span>
                    <span>{formatRelative(file.updatedAt)}</span>
                  </div>
                </div>
                <div className="absolute top-2 left-2">
                  <SimpleCheckbox
                    checked={isSel}
                    onChange={() => toggleSelect(file.id)}
                    ariaLabel="Selecionar"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        folderId={currentFolderId}
        onUploaded={refresh}
      />
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        parentId={currentFolderId}
        onCreated={refresh}
      />
      {renameTarget && (
        <RenameDialog
          open={!!renameTarget}
          onOpenChange={(o) => !o && setRenameTarget(null)}
          initialName={renameTarget.name}
          title={renameTarget.type === 'folder' ? 'Renomear pasta' : 'Renomear arquivo'}
          onConfirm={async (name) => {
            if (renameTarget.type === 'file') {
              await api.patch(`/api/v1/files/${renameTarget.id}`, { name });
            } else {
              await api.patch(`/api/v1/folders/${renameTarget.id}`, { name });
            }
            toast.success('Renomeado');
            refresh();
          }}
        />
      )}
      {moveTarget && (
        <MoveDialog
          open={!!moveTarget}
          onOpenChange={(o) => !o && setMoveTarget(null)}
          excludeId={moveTarget.type === 'folder' ? moveTarget.id : undefined}
          onConfirm={async (folderId) => {
            if (moveTarget.type === 'file') {
              await api.patch(`/api/v1/files/${moveTarget.id}`, { folderId });
            } else {
              await api.patch(`/api/v1/folders/${moveTarget.id}`, { parentId: folderId });
            }
            toast.success('Movido');
            refresh();
          }}
        />
      )}
    </div>
  );
}
