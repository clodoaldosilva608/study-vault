'use client';

import { useEffect, useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

  async function refreshBreadcrumbs(folderId: string | null) {
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
        cur = cur.parent as any;
      }
      chain.unshift({ id: null, name: 'Root' });
      setBreadcrumbs(chain);
    } catch {
      setBreadcrumbs([{ id: null, name: 'Root' }]);
    }
  }

  useEffect(() => {
    refresh();
    clearSelection();
  }, [refresh, clearSelection]);

  async function handleDelete(file: FileItem) {
    if (!confirm(`Delete "${file.name}"? It will be moved to trash.`)) return;
    try {
      await api.delete(`/api/v1/files/${file.id}`);
      toast.success('Moved to trash');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    }
  }

  async function handleDeleteFolder(folder: FolderItem) {
    if (!confirm(`Delete folder "${folder.name}" and all its contents? They go to trash.`)) return;
    try {
      await api.delete(`/api/v1/folders/${folder.id}`);
      toast.success('Folder moved to trash');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    }
  }

  async function toggleFavorite(file: FileItem) {
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
  }

  async function handleDownload(file: FileItem) {
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
  }

  async function handleBulkDelete() {
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
  }

  // Drag & drop
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggingFileIds, setDraggingFileIds] = useState<Set<string>>(new Set());

  function onFileDragStart(e: React.DragEvent, id: string) {
    const ids = selected.size > 0 && selected.has(id) ? Array.from(selected) : [id];
    e.dataTransfer.setData('application/x-study-vault-files', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingFileIds(new Set(ids));
  }

  function onFolderDragOver(e: React.DragEvent, folderId: string) {
    if (e.dataTransfer.types.includes('application/x-study-vault-files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolderId(folderId);
    }
  }

  async function onFolderDrop(e: React.DragEvent, targetFolderId: string) {
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
  }

  const allSelected = files.length > 0 && files.every((f) => selected.has(f.id));

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumbs.map((b, i) => (
            <span key={b.id ?? 'root'} className="flex items-center gap-1">
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
              Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)} className="gap-2">
            <FolderPlus className="h-3.5 w-3.5" /> New folder
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </div>

      {/* Select-all row */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(v) => {
              if (v) selectMany(files.map((f) => f.id));
              else clearSelection();
            }}
            aria-label="Select all"
          />
          <span>
            {files.length} file{files.length !== 1 ? 's' : ''} · {selected.size} selected
          </span>
        </div>
      )}

      {/* Folder + file grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">This folder is empty</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Upload a file or create a subfolder to get started.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)} className="gap-2">
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </Button>
            <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Upload
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
                'group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent/40 hover:border-border/80 transition-colors text-center',
                dragOverFolderId === folder.id
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/8'
                  : 'border-border/60',
              )}
            >
              <Folder className="h-8 w-8 text-primary/80 group-hover:text-primary transition-colors" />
              <div className="w-full">
                <div className="text-xs font-medium truncate">{folder.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {folder.path || '/'}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background"
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setRenameTarget({ type: 'folder', id: folder.id, name: folder.name })}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setMoveTarget({ type: 'folder', id: folder.id })}
                  >
                    <FolderInput className="h-3.5 w-3.5 mr-2" /> Move
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteFolder(folder)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  'group relative flex flex-col gap-2 p-3 rounded-xl border bg-card hover:bg-accent/30 hover:border-border/80 transition-all cursor-pointer',
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
                      aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                    >
                      {isFav ? (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenameTarget({ type: 'file', id: file.id, name: file.name })}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMoveTarget({ type: 'file', id: file.id })}>
                          <FolderInput className="h-3.5 w-3.5 mr-2" /> Move
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(file)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium leading-tight line-clamp-2 break-all">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span className="opacity-50">·</span>
                    <span>{formatRelative(file.updatedAt)}</span>
                  </div>
                </div>
                <Checkbox
                  checked={isSel}
                  onCheckedChange={() => toggleSelect(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2"
                  aria-label="Select"
                />
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
          title={renameTarget.type === 'folder' ? 'Rename folder' : 'Rename file'}
          onConfirm={async (name) => {
            if (renameTarget.type === 'file') {
              await api.patch(`/api/v1/files/${renameTarget.id}`, { name });
            } else {
              await api.patch(`/api/v1/folders/${renameTarget.id}`, { name });
            }
            toast.success('Renamed');
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
            toast.success('Moved');
            refresh();
          }}
        />
      )}
    </div>
  );
}
