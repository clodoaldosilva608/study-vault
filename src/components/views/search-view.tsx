'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Download, Loader2 } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';
import { formatBytes, formatRelative } from '@/lib/utils/file';
import { FileTypeIcon } from '@/components/common/file-type-icon';
import { useAppStore } from '@/lib/store/app-store';

type FileItem = {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
  folder?: { id: string; name: string } | null;
};

export function SearchView() {
  const [query, setQuery] = useState('');
  const [ext, setExt] = useState('');
  const [results, setResults] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder);
  const setView = useAppStore((s) => s.setView);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() && !ext.trim()) {
      toast.error('Enter a search term or extension');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.set('query', query.trim());
      if (ext.trim()) params.set('extension', ext.trim().replace(/^\./, ''));
      const r = await api.get<{ items: FileItem[]; total: number }>(
        `/api/v1/search?${params.toString()}`,
      );
      setResults(r.items);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
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

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
      <Card className="p-4">
        <form onSubmit={doSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by file name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Input
            placeholder="ext (pdf, md, …)"
            value={ext}
            onChange={(e) => setExt(e.target.value)}
            className="sm:w-40"
          />
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
            Search
          </Button>
        </form>
      </Card>

      {searched && (
        <div className="text-xs text-muted-foreground">
          {loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
        </div>
      )}

      {results.length > 0 && (
        <Card className="divide-y divide-border">
          {results.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <FileTypeIcon mimeType={f.mimeType} extension={f.extension} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {f.folder?.name ?? 'Root'} · {formatBytes(f.sizeBytes)} · {formatRelative(f.updatedAt)}
                </div>
              </div>
              {f.folder && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCurrentFolder(f.folder!.id); setView('files'); }}
                >
                  Open folder
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => download(f.id, f.name)} aria-label="Download">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {searched && !loading && results.length === 0 && (
        <Card className="p-10 text-center border-dashed">
          <SearchIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">No results</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different name or extension.
          </p>
        </Card>
      )}
    </div>
  );
}
