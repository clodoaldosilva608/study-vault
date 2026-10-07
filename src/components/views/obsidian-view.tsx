'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Download, Upload, Loader2, ArrowRight } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';

export function ObsidianView() {
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<{ name: string; content: string; folderPath?: string }[] | null>(null);

  async function handleImport() {
    if (!importText.trim()) {
      toast.error('Paste Markdown content first');
      return;
    }
    setImporting(true);
    try {
      const files = parseMarkdownFiles(importText);
      if (files.length === 0) {
        toast.error('No valid Markdown files detected');
        return;
      }
      const r = await api.post<{ imported: number; skipped: number; errors: any[] }>(
        '/api/v1/obsidian/import',
        { files },
      );
      toast.success(`Imported ${r.imported} note(s), skipped ${r.skipped} duplicate(s)`);
      setImportText('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const r = await api.get<{ vault: { name: string; content: string; folderPath?: string }[]; count: number }>(
        '/api/v1/obsidian/export',
      );
      setExported(r.vault);
      toast.success(`Exported ${r.count} notes`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function downloadVault() {
    if (!exported) return;
    // Single concatenated .md as a ZIP-less export for MVP
    const text = exported
      .map((f) => `---\n# path: ${f.folderPath ? f.folderPath + '/' : ''}${f.name}\n---\n\n${f.content}\n`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-vault-export.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
      <Card className="p-4 border-border/60">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            Obsidian sync foundation. MVP supports <strong>one-way Markdown import</strong> (paste
            Markdown, files become notes) and <strong>one-way export</strong> (notes → Markdown
            bundle). Bidirectional sync with devices and conflict resolution arrives in V1.2 — see
            <code className="mx-1 px-1 py-0.5 rounded bg-muted-foreground/10 text-[10px]">docs/adr/ADR-004-obsidian-sync.md</code>.
          </div>
        </div>
      </Card>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import" className="gap-2"><Upload className="h-3.5 w-3.5" /> Import</TabsTrigger>
          <TabsTrigger value="export" className="gap-2"><Download className="h-3.5 w-3.5" /> Export</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-text">Markdown to import</Label>
              <p className="text-[11px] text-muted-foreground">
                Paste one or more Markdown files separated by <code>---{'\n'}path: Folder/Subfolder/Name.md{'\n'}---</code>.
                Files will be created as notes under <code>Obsidian Import/</code> with the same folder structure.
              </p>
              <Textarea
                id="import-text"
                rows={14}
                placeholder={'---\npath: Direito/Constitucional/Controle.md\n---\n\n# Controle de Constitucionalidade\n\nResumo do material…\n\n---\npath: Direito/Administrativo/Atos.md\n---\n\n# Atos Administrativos\n\n...'}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import Markdown
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-3">
          <Card className="p-4 space-y-3">
            <div>
              <Label>Export workspace notes</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Exports all non-deleted notes from this workspace as Markdown. Folder structure
                is preserved.
              </p>
            </div>
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate export
            </Button>
            {exported && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {exported.length} note{exported.length !== 1 ? 's' : ''} ready
                  </span>
                  <Button size="sm" variant="outline" onClick={downloadVault} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download .md bundle
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto border rounded-md divide-y divide-border">
                  {exported.map((f, i) => (
                    <div key={i} className="p-2.5 flex items-center gap-2 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 truncate">
                        {f.folderPath && <span className="text-muted-foreground">{f.folderPath}/</span>}
                        <span className="font-medium">{f.name}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">{f.content.length} chars</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function parseMarkdownFiles(text: string): { name: string; content: string; folderPath?: string }[] {
  const files: { name: string; content: string; folderPath?: string }[] = [];
  const parts = text.split(/^---\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const pathMatch = part.match(/^path:\s*(.+)$/m);
    if (pathMatch) {
      const fullPath = pathMatch[1].trim();
      const lastSlash = fullPath.lastIndexOf('/');
      const name = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath;
      const folderPath = lastSlash >= 0 ? fullPath.slice(0, lastSlash) : undefined;
      const content = part.replace(/^path:\s*.+$/m, '').trim();
      files.push({ name, content, folderPath });
    } else {
      // No path header — treat the whole part as a single file
      files.push({ name: `untitled-${Date.now()}.md`, content: part });
    }
  }
  return files;
}
