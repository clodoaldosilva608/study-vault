'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ReactMarkdown from 'react-markdown';
import { StickyNote, Plus, Save, Trash2, Loader2, FileText } from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';
import { formatRelative } from '@/lib/utils/file';
import { cn } from '@/lib/utils';

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  folder?: { id: string; name: string } | null;
};

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const refresh = () => {
    setLoading(true);
    api
      .get<{ items: Note[]; total: number }>('/api/v1/notes?pageSize=100')
      .then((r) => {
        setNotes(r.items);
        if (r.items.length > 0 && !selectedId) {
          setSelectedId(r.items[0].id);
          setDraft({ title: r.items[0].title, content: r.items[0].content });
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  useEffect(() => {
    if (!selectedId) return;
    const n = notes.find((x) => x.id === selectedId);
    if (n) setDraft({ title: n.title, content: n.content });
  }, [selectedId, notes]);

  async function createNew() {
    setSaving(true);
    try {
      const r = await api.post<{ note: Note }>('/api/v1/notes', {
        title: 'Untitled note',
        content: '',
      });
      toast.success('Note created');
      setShowNew(false);
      refresh();
      setSelectedId(r.note.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/notes/${selectedId}`, {
        title: draft.title,
        content: draft.content,
      });
      toast.success('Saved');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this note? It goes to soft-delete.')) return;
    try {
      await api.delete(`/api/v1/notes/${id}`);
      toast.success('Note deleted');
      if (selectedId === id) setSelectedId(null);
      refresh();
    } catch {
      toast.error('Failed');
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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)]">
        {/* Notes list */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes ({notes.length})
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1.5 h-7">
              <Plus className="h-3 w-3" /> New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No notes yet. Click <strong>New</strong> to create one.
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-accent/40 transition-colors',
                    selectedId === n.id && 'bg-primary/8 border-l-2 border-l-primary',
                  )}
                >
                  <div className="text-sm font-medium truncate">{n.title || 'Untitled'}</div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {n.content.slice(0, 60) || 'Empty'} · {formatRelative(n.updatedAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Editor / preview */}
        <Card className="flex flex-col overflow-hidden">
          {selectedId ? (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <StickyNote className="h-3.5 w-3.5 text-primary" />
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="border-0 bg-transparent focus-visible:ring-0 px-0 text-sm font-medium"
                />
                <Button size="sm" variant="outline" onClick={save} disabled={saving} className="gap-1.5 h-7">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(selectedId)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-x divide-border overflow-hidden">
                <div className="overflow-y-auto">
                  <Textarea
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    placeholder="Write Markdown here…"
                    className="border-0 rounded-none resize-none focus-visible:ring-0 font-mono text-xs h-full min-h-[400px]"
                  />
                </div>
                <div className="overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{draft.content || '*Preview will appear here*'}</ReactMarkdown>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Select a note or create a new one.</p>
              <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New note
              </Button>
            </div>
          )}
        </Card>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <Card className="p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Create note</h3>
            <Label className="text-xs">Title</Label>
            <Input
              placeholder="Note title"
              autoFocus
              className="mb-3"
              value={draft.title === 'Untitled note' ? '' : draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') createNew(); }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button size="sm" onClick={createNew} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
