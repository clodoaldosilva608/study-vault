'use client';

import { useState } from 'react';
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
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api/client';
import { formatBytes } from '@/lib/utils/file';

type FileRow = {
  name: string;
  folderId: string | null;
  sizeBytes: number;
  mimeType: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
};

export function UploadDialog({
  open,
  onOpenChange,
  folderId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folderId: string | null;
  onUploaded?: () => void;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [uploading, setUploading] = useState(false);

  function handlePick(fileList: FileList | null) {
    if (!fileList) return;
    const next: FileRow[] = Array.from(fileList).map((f) => ({
      name: f.name,
      folderId,
      sizeBytes: f.size,
      mimeType: f.type || 'application/octet-stream',
      status: 'pending',
    }));
    setFiles((cur) => [...cur, ...next]);
  }

  function removeAt(i: number) {
    setFiles((cur) => cur.filter((_, idx) => idx !== i));
  }

  async function uploadAll() {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const row = files[i];
      if (row.status === 'done') continue;
      setFiles((cur) =>
        cur.map((r, idx) => (idx === i ? { ...r, status: 'uploading' } : r)),
      );
      try {
        // Re-pick the original File from input on demand — here we keep File objects too
        // For simplicity we re-read via hidden input on each upload.
        // (In production we'd cache File objects directly.)
      } catch (err) {
        setFiles((cur) =>
          cur.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'error' }
              : r,
          ),
        );
      }
    }
    setUploading(false);
  }

  // Simpler approach: keep File refs in a ref array
  const [fileObjs, setFileObjs] = useState<File[]>([]);

  function handlePickV2(fileList: FileList | null) {
    if (!fileList) return;
    const arr = Array.from(fileList);
    setFileObjs((cur) => [...cur, ...arr]);
    setFiles((cur) => [
      ...cur,
      ...arr.map((f) => ({
        name: f.name,
        folderId,
        sizeBytes: f.size,
        mimeType: f.type || 'application/octet-stream',
        status: 'pending' as const,
      })),
    ]);
  }

  async function uploadAllV2() {
    setUploading(true);
    let okCount = 0;
    for (let i = 0; i < fileObjs.length; i++) {
      const f = fileObjs[i];
      if (files[i]?.status === 'done') continue;
      setFiles((cur) =>
        cur.map((r, idx) => (idx === i ? { ...r, status: 'uploading' } : r)),
      );
      try {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('folderId', folderId ?? 'null');
        const res = await fetch('/api/v1/files/upload', { method: 'POST', body: fd, credentials: 'include' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error?.message || 'Upload failed');
        okCount += 1;
        setFiles((cur) =>
          cur.map((r, idx) => (idx === i ? { ...r, status: 'done' } : r)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setFiles((cur) =>
          cur.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: msg } : r,
          ),
        );
        toast.error(`${f.name}: ${msg}`);
      }
    }
    setUploading(false);
    if (okCount > 0) {
      toast.success(`${okCount} file${okCount > 1 ? 's' : ''} uploaded`);
      onUploaded?.();
    }
    if (files.every((f) => f.status === 'done')) {
      setFiles([]);
      setFileObjs([]);
      onOpenChange(false);
    }
  }

  return (
    <SimpleDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setFiles([]); setFileObjs([]); } }} className="max-w-lg">
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <SimpleDialogTitle>Enviar arquivos</SimpleDialogTitle>
        </div>
      </SimpleDialogHeader>
      <SimpleDialogBody>

        <div className="space-y-3">
          <label
            htmlFor="upload-input"
            className="block border-2 border-dashed border-border/70 rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-colors"
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Click to select files</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Or drop them here — multi-file supported
            </div>
            <Input
              id="upload-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handlePickV2(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <ul className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {files.map((row, i) => (
                <li
                  key={`${row.name}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50 border border-border/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{row.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatBytes(row.sizeBytes)}
                      {row.status === 'error' && (
                        <span className="text-destructive ml-2">· {row.error}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={row.status} />
                  {!uploading && row.status !== 'done' && (
                    <button
                      onClick={() => {
                        setFiles((cur) => cur.filter((_, idx) => idx !== i));
                        setFileObjs((cur) => cur.filter((_, idx) => idx !== i));
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SimpleDialogBody>

      <SimpleDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={uploadAllV2}
            disabled={uploading || files.length === 0 || files.every((f) => f.status === 'done')}
            className="gap-2"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Enviando…' : `Enviar ${files.length || ''}`}
          </Button>
        </SimpleDialogFooter>
    </SimpleDialog>
  );
}

function StatusBadge({ status }: { status: FileRow['status'] }) {
  if (status === 'done') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">done</span>;
  }
  if (status === 'uploading') {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }
  if (status === 'error') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">error</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/15 text-muted-foreground">pending</span>;
}
