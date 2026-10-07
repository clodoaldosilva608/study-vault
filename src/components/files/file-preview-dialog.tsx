'use client';

import { useState, useEffect } from 'react';
import {
  SimpleDialog,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogBody,
  SimpleDialogClose,
} from '@/components/common/simple-dialog';
import { Button } from '@/components/ui/button';
import {
  Download,
  Printer,
  Share2,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { fileKind } from '@/lib/utils/file';
import { ShareDialog } from '@/components/files/share-dialog';

type FileItem = {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
};

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!open || !file) {
      setTextContent(null);
      return;
    }

    async function loadFile() {
      setLoading(true);
      const kind = fileKind(file!.mimeType, file!.extension);

      // For text-like files, fetch as text
      if (
        kind === 'text' ||
        kind === 'markdown' ||
        file!.mimeType.startsWith('text/') ||
        file!.extension === 'md' ||
        file!.extension === 'txt' ||
        file!.extension === 'csv' ||
        file!.extension === 'json'
      ) {
        try {
          const res = await fetch(`/api/v1/files/${file!.id}/view`, {
            credentials: 'include',
          });
          if (res.ok) {
            const text = await res.text();
            setTextContent(text);
          }
        } catch {
          // ignore
        }
      }
      // For binary files, we use the /view URL directly in img/iframe/video tags
      setLoading(false);
    }

    loadFile();
  }, [open, file]);

  if (!file) return null;

  const kind = fileKind(file.mimeType, file.extension);
  // The /view endpoint returns Content-Disposition: inline so the browser
  // displays the file instead of downloading it.
  const viewUrl = `/api/v1/files/${file.id}/view`;

  const handlePrint = () => {
    // Open the file in a new window for printing
    const printWindow = window.open(viewUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 500);
      };
    }
  };

  const handleDownload = async () => {
    // Use /download endpoint which forces download (Content-Disposition: attachment)
    const res = await fetch(`/api/v1/files/${file.id}/download`, {
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <SimpleDialog
        open={open}
        onOpenChange={onOpenChange}
        className="max-w-4xl"
      >
        <SimpleDialogClose onClose={() => onOpenChange(false)} />
        <SimpleDialogHeader>
          <div className="flex items-center justify-between w-full">
            <SimpleDialogTitle className="truncate pr-4">
              {file.name}
            </SimpleDialogTitle>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrint}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Imprimir"
                title="Imprimir"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowShare(true)}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Compartilhar"
                title="Compartilhar"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                aria-label="Baixar"
                title="Baixar"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SimpleDialogHeader>
        <SimpleDialogBody>
          <div className="min-h-[300px] max-h-[70vh] overflow-auto flex items-center justify-center bg-muted/30 rounded-md">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Carregando...</p>
              </div>
            ) : kind === 'image' ? (
              <img
                src={viewUrl}
                alt={file.name}
                className="max-w-full max-h-[70vh] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : kind === 'pdf' ? (
              <iframe
                src={viewUrl}
                className="w-full h-[70vh] border-0"
                title={file.name}
              />
            ) : kind === 'video' ? (
              <video
                src={viewUrl}
                controls
                className="max-w-full max-h-[70vh]"
              />
            ) : kind === 'audio' ? (
              <div className="flex flex-col items-center gap-4 py-12 w-full px-8">
                <FileIcon className="h-16 w-16 text-muted-foreground" />
                <audio src={viewUrl} controls className="w-full" />
                <p className="text-sm font-medium">{file.name}</p>
              </div>
            ) : (kind === 'text' || kind === 'markdown') && textContent !== null ? (
              <pre className="w-full p-4 text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
                {textContent}
              </pre>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12">
                <FileIcon className="h-16 w-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Visualização não disponível para este tipo de arquivo
                </p>
                <Button size="sm" variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="h-3.5 w-3.5" /> Baixar arquivo
                </Button>
              </div>
            )}
          </div>
        </SimpleDialogBody>
      </SimpleDialog>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        fileName={file.name}
        fileId={file.id}
      />
    </>
  );
}
