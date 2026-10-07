'use client';

import { useState, useRef, useCallback } from 'react';
import {
  SimpleDialog,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogBody,
  SimpleDialogFooter,
  SimpleDialogClose,
} from '@/components/common/simple-dialog';
import { Button } from '@/components/ui/button';
import { FolderDown, Loader2, CheckCircle2, XCircle, Folder, File as FileIcon } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type UploadItem = {
  path: string;
  name: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  folderPath: string; // relative path within the imported folder
};

type FolderItem = { id: string; name: string };

export function FolderImportDialog({
  open,
  onOpenChange,
  parentId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parentId: string | null;
  onImported?: () => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setItems([]);
    setUploading(false);
    setDone(false);
  };

  /**
   * Recursively walks a FileSystemDirectoryEntry, collecting all files
   * with their relative paths. This is the key to preserving folder structure.
   */
  const walkDirectory = useCallback(
    (
      entry: any,
      path: string,
      collected: UploadItem[],
    ): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file((file: File) => {
            collected.push({
              path: path + file.name,
              name: file.name,
              file,
              status: 'pending',
              folderPath: path.replace(/\/$/, ''),
            });
            resolve();
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readEntries = () => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) {
                resolve();
                return;
              }
              for (const e of entries) {
                await walkDirectory(e, path + entry.name + '/', collected);
              }
              // readEntries may not return all entries at once — keep reading
              readEntries();
            });
          };
          readEntries();
        } else {
          resolve();
        }
      });
    },
    [],
  );

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const collected: UploadItem[] = [];

    // Check if we got webkitRelativePath (folder selected via input)
    // vs FileSystemEntry (drag-and-drop or showDirectoryPicker)
    const firstFile = fileList[0] as any;
    if (firstFile && firstFile.webkitRelativePath) {
      // Folder selected via <input webkitdirectory> — each file has a relative path
      for (const file of Array.from(fileList)) {
        const f = file as any;
        const relativePath = f.webkitRelativePath || f.name;
        const parts = relativePath.split('/');
        // Remove the first part (the root folder name) — we don't want to create
        // a folder with the same name as the imported folder, just its contents
        const subPath = parts.slice(1, -1).join('/');
        collected.push({
          path: relativePath,
          name: file.name,
          file,
          status: 'pending',
          folderPath: subPath,
        });
      }
    } else {
      // Fallback: just use file names without folder structure
      for (const file of Array.from(fileList)) {
        collected.push({
          path: file.name,
          name: file.name,
          file,
          status: 'pending',
          folderPath: '',
        });
      }
    }

    // Sort by path so folders are created in order
    collected.sort((a, b) => a.path.localeCompare(b.path));
    setItems(collected);
    setDone(false);
  }

  /**
   * Find or create a folder by path, returning the folder ID.
   * Creates all intermediate folders as needed.
   */
  async function ensureFolder(
    workspaceFolderId: string | null,
    relativePath: string,
  ): Promise<string | null> {
    if (!relativePath) return workspaceFolderId;

    const parts = relativePath.split('/').filter(Boolean);
    let currentParentId = workspaceFolderId;

    for (const part of parts) {
      // Try to find existing folder with this name under current parent
      const params = new URLSearchParams();
      params.set('parentId', currentParentId ?? 'null');
      const resp = await api.get<{ items: FolderItem[] }>(
        `/api/v1/folders?${params.toString()}`,
      );
      const existing = resp.items.find((f) => f.name === part);

      if (existing) {
        currentParentId = existing.id;
      } else {
        // Create the folder
        const created = await api.post<{ id: string; name: string }>(
          '/api/v1/folders',
          { name: part, parentId: currentParentId ?? null },
        );
        currentParentId = created.id;
      }
    }

    return currentParentId;
  }

  /**
   * Upload a single file to the specified folder.
   */
  async function uploadFile(item: UploadItem, folderId: string | null): Promise<void> {
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('folderId', folderId ?? 'null');

    const res = await fetch('/api/v1/files/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message || 'Upload failed');
  }

  async function startUpload() {
    if (items.length === 0) return;
    setUploading(true);
    setDone(false);

    // Cache: map folderPath -> folderId (avoids re-querying for every file)
    const folderCache = new Map<string, string | null>();
    folderCache.set('', parentId);

    let completed = 0;
    let errors = 0;
    const total = items.length;

    // Process files sequentially to maintain folder creation order.
    // Parallel upload (3-5 at once) for files in the SAME folder.
    const CONCURRENCY = 3;
    let index = 0;

    const processNext = async (): Promise<void> => {
      while (index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];

        // Ensure the folder exists (use cache)
        let folderId: string | null;
        if (folderCache.has(item.folderPath)) {
          folderId = folderCache.get(item.folderPath)!;
        } else {
          try {
            folderId = await ensureFolder(parentId, item.folderPath);
            folderCache.set(item.folderPath, folderId);
          } catch (err) {
            // Mark this file and all subsequent files in the same folder as error
            folderId = null;
            folderCache.set(item.folderPath, null);
          }
        }

        // Update status to uploading
        setItems((prev) =>
          prev.map((it, i) =>
            i === currentIndex ? { ...it, status: 'uploading' } : it,
          ),
        );

        try {
          await uploadFile(item, folderId);
          completed++;
          setItems((prev) =>
            prev.map((it, i) =>
              i === currentIndex ? { ...it, status: 'done' } : it,
            ),
          );
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : 'Erro';
          setItems((prev) =>
            prev.map((it, i) =>
              i === currentIndex
                ? { ...it, status: 'error', error: msg }
                : it,
            ),
          );
        }
      }
    };

    // Launch CONCURRENCY workers
    await Promise.all(Array.from({ length: CONCURRENCY }, () => processNext()));

    setUploading(false);
    setDone(true);

    if (errors === 0) {
      toast.success(`${completed} arquivo(s) importado(s) com sucesso!`);
    } else {
      toast.warning(`${completed} enviados, ${errors} com erro`);
    }
    onImported?.();
  }

  const completedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <SimpleDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      className="max-w-2xl"
    >
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <div className="flex items-center gap-2">
          <FolderDown className="h-4 w-4 text-primary" />
          <SimpleDialogTitle>Importar pasta</SimpleDialogTitle>
        </div>
      </SimpleDialogHeader>
      <SimpleDialogBody>
        {items.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione uma pasta do seu computador. Todos os arquivos e
              subpastas serão importados, mantendo a estrutura original.
            </p>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border/70 rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-colors"
            >
              <FolderDown className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <div className="text-sm font-medium">Clique para selecionar uma pasta</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Funciona em Chrome, Edge e Opera (desktop)
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              // @ts-expect-error — webkitdirectory is non-standard but works in Chrome/Edge
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <div className="text-[11px] text-muted-foreground bg-muted/40 border rounded-md p-3">
              <strong>Dica:</strong> Para selecionar uma pasta inteira, clique
              no botão acima e escolha uma pasta no seletor de arquivos do
              sistema. A estrutura de subpastas será preservada.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Enviando... {completedCount}/{items.length}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{items.length} arquivo(s)</span>
              {completedCount > 0 && (
                <span className="text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedCount} ok
                </span>
              )}
              {uploadingCount > 0 && (
                <span className="text-blue-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {uploadingCount} enviando
                </span>
              )}
              {pendingCount > 0 && (
                <span>{pendingCount} pendente(s)</span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {errorCount} erro(s)
                </span>
              )}
            </div>

            {/* File list */}
            <div className="max-h-72 overflow-y-auto border rounded-md">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/50 last:border-0',
                    item.status === 'done' && 'bg-emerald-500/5',
                    item.status === 'error' && 'bg-destructive/5',
                    item.status === 'uploading' && 'bg-blue-500/5',
                  )}
                >
                  {item.status === 'done' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : item.status === 'error' ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : item.status === 'uploading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                  ) : (
                    <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate">{item.path}</span>
                  {item.error && (
                    <span className="text-destructive text-[10px] truncate max-w-32">
                      {item.error}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {done && (
              <div className="text-xs text-center text-muted-foreground">
                Importação concluída! {completedCount} arquivo(s) enviado(s)
                {errorCount > 0 && `, ${errorCount} com erro`}.
              </div>
            )}
          </div>
        )}
      </SimpleDialogBody>
      <SimpleDialogFooter>
        {done ? (
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        ) : items.length === 0 ? (
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            {!uploading && !done && (
              <Button onClick={startUpload} disabled={items.length === 0} className="gap-2">
                <FolderDown className="h-4 w-4" />
                Importar {items.length} arquivo(s)
              </Button>
            )}
          </>
        )}
      </SimpleDialogFooter>
    </SimpleDialog>
  );
}
