'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Bot,
  Copy,
  Key,
  Loader2,
  Plus,
  Trash2,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelative } from '@/lib/utils/file';

type Credential = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type ToolManifest = {
  name: string;
  description: string;
  requiredScopes: string[];
  inputSchema: Record<string, { type: string; required?: boolean; description: string }>;
};

export function JarvisView() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  // Tool manifest is fetched with the agent token (only shown when user has at least one cred).
  const [tools, setTools] = useState<ToolManifest[]>([]);
  const [manifestToken, setManifestToken] = useState('');
  const [loadingTools, setLoadingTools] = useState(false);

  // Playground
  const [playToken, setPlayToken] = useState('');
  const [playTool, setPlayTool] = useState('search_files');
  const [playArgs, setPlayArgs] = useState('{\n  "query": "direito"\n}');
  const [playResult, setPlayResult] = useState<string | null>(null);
  const [playLoading, setPlayLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    api
      .get<{ items: Credential[] }>('/api/v1/agent/credentials')
      .then((r) => setCreds(r.items))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  async function issue() {
    if (!newName.trim()) {
      toast.error('Enter a credential name');
      return;
    }
    setCreating(true);
    try {
      const r = await api.post<{ credential: Credential; plainToken: string }>(
        '/api/v1/agent/credentials',
        { name: newName.trim() },
      );
      setIssuedToken(r.plainToken);
      setShowNew(false);
      setNewName('');
      toast.success('Credential issued — copy the token now, it won\'t be shown again');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this credential? JARVIS will lose access immediately.')) return;
    try {
      await api.delete(`/api/v1/agent/credentials/${id}`);
      toast.success('Credential revoked');
      refresh();
    } catch {
      toast.error('Failed');
    }
  }

  async function fetchTools() {
    if (!manifestToken.trim()) {
      toast.error('Paste an agent API key first');
      return;
    }
    setLoadingTools(true);
    try {
      const res = await fetch('/api/v1/agent/tools', {
        headers: { Authorization: `Bearer ${manifestToken.trim()}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || 'Failed');
      setTools(json.data.tools);
      setPlayToken(manifestToken.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoadingTools(false);
    }
  }

  async function invokeTool() {
    if (!playToken.trim()) {
      toast.error('Paste an agent API key in the manifest section first');
      return;
    }
    let args: unknown = {};
    try {
      args = JSON.parse(playArgs);
    } catch {
      toast.error('Args must be valid JSON');
      return;
    }
    setPlayLoading(true);
    setPlayResult(null);
    try {
      const res = await fetch('/api/v1/agent/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playToken.trim()}`,
        },
        body: JSON.stringify({ tool: playTool, args }),
      });
      const json = await res.json();
      setPlayResult(JSON.stringify(json, null, 2));
      if (!json.ok) {
        toast.error(json.error?.message || 'Tool call failed');
      } else {
        toast.success('Tool invoked');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPlayLoading(false);
    }
  }

  function copyToken() {
    if (!issuedToken) return;
    navigator.clipboard.writeText(issuedToken);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-7xl mx-auto">
      {/* Hero */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="flex items-start gap-3">
          <Bot className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">JARVIS Tool Layer</h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Issue scoped API keys for the JARVIS agent. Every tool call authenticates, checks
              scopes, executes through the domain layer, and writes an audit record — JARVIS never
              touches the database or storage directly.
            </p>
          </div>
        </div>
      </Card>

      {/* Credentials */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Agent credentials
          </h3>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Issue new
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : creds.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-md">
            <Key className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm">No credentials yet. Issue one to let JARVIS call the API.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {creds.map((c) => (
              <li key={c.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {c.tokenPrefix}…
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {JSON.parse(c.scopes).map((s: string) => (
                      <span
                        key={s}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Created {formatRelative(c.createdAt)}
                    {c.lastUsedAt && ` · last used ${formatRelative(c.lastUsedAt)}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => revoke(c.id)} aria-label="Revoke">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tool manifest */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Terminal className="h-4 w-4 text-primary" /> Tool manifest
        </h3>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Paste an agent API key (sva_…)"
            value={manifestToken}
            onChange={(e) => setManifestToken(e.target.value)}
            type="password"
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={fetchTools} disabled={loadingTools} className="gap-1.5">
            {loadingTools ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Load tools
          </Button>
        </div>

        {tools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tools.map((t) => (
              <div key={t.name} className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs font-mono font-medium">{t.name}</code>
                  <Badge variant="outline" className="text-[9px] px-1.5">
                    {t.requiredScopes.length} scope(s)
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  {t.requiredScopes.map((s) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Issue a credential above, copy its API key, paste it here, then click <strong>Load tools</strong>.
          </p>
        )}
      </Card>

      {/* Playground */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Terminal className="h-4 w-4 text-primary" /> Tool invocation playground
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Tool</Label>
            <Input
              value={playTool}
              onChange={(e) => setPlayTool(e.target.value)}
              className="font-mono text-xs"
              placeholder="search_files"
            />
            <Label className="text-xs">Args (JSON)</Label>
            <Textarea
              value={playArgs}
              onChange={(e) => setPlayArgs(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={invokeTool} disabled={playLoading} className="gap-1.5">
              {playLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
              Invoke tool
            </Button>
          </div>
          <div>
            <Label className="text-xs">Response</Label>
            <pre className="text-[11px] font-mono bg-muted/40 border rounded-md p-3 h-[280px] overflow-auto whitespace-pre-wrap">
              {playResult || '// response will appear here'}
            </pre>
          </div>
        </div>
      </Card>

      {/* Issue credential dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Issue agent credential
            </DialogTitle>
            <DialogDescription>
              Issues a new API key with default read-only scopes. The plain token is shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cred-name">Friendly name</Label>
            <Input
              id="cred-name"
              placeholder="e.g. JARVIS Production"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={issue} disabled={creating || !newName.trim()} className="gap-1.5">
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issued token display */}
      <Dialog open={!!issuedToken} onOpenChange={(o) => !o && setIssuedToken(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Credential issued
            </DialogTitle>
            <DialogDescription>
              Copy this token now. For security, it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 border rounded-md p-3 font-mono text-xs break-all">
            {issuedToken}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyToken} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy token
            </Button>
            <Button onClick={() => setIssuedToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
