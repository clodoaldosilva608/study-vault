'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, Filter } from 'lucide-react';
import { formatRelative } from '@/lib/utils/file';

type AuditItem = {
  id: string;
  actorType: string;
  actorName: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  requestId: string;
  metadata: string;
  outcome: string;
  createdAt: string;
};

export function AuditView() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (filter) params.set('action', filter);
    api
      .get<{ items: AuditItem[]; total: number }>(`/api/v1/audit?${params.toString()}`)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [page, filter]);

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-7xl mx-auto">
      <Card className="p-4 border-border/60">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            Every sensitive operation — uploads, deletes, restores, agent tool calls — is recorded
            with actor, action, outcome, and request ID. Use the filter to narrow by action code
            (e.g. <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-[10px]">UPLOAD_FILE</code> or <code className="px-1 py-0.5 rounded bg-muted-foreground/10 text-[10px]">JARVIS_*</code>).
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter by action (e.g. JARVIS_SEARCH_FILES)"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {total} record{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="text-left font-medium p-2.5">When</th>
                  <th className="text-left font-medium p-2.5">Actor</th>
                  <th className="text-left font-medium p-2.5">Action</th>
                  <th className="text-left font-medium p-2.5">Resource</th>
                  <th className="text-left font-medium p-2.5">Outcome</th>
                  <th className="text-left font-medium p-2.5">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No audit records yet.
                    </td>
                  </tr>
                ) : (
                  items.map((a) => (
                    <tr key={a.id} className="hover:bg-accent/30">
                      <td className="p-2.5 whitespace-nowrap">{formatRelative(a.createdAt)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              a.actorType === 'AGENT'
                                ? 'border-primary/40 text-primary text-[9px] px-1.5'
                                : a.actorType === 'SYSTEM'
                                ? 'border-muted-foreground/40 text-muted-foreground text-[9px] px-1.5'
                                : 'border-chart-2/40 text-chart-2 text-[9px] px-1.5'
                            }
                          >
                            {a.actorType}
                          </Badge>
                          <span className="truncate max-w-[160px]">{a.actorName}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <code className="text-[10px] font-mono">{a.action}</code>
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {a.resourceType ? (
                          <span>{a.resourceType}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}…` : ''}</span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5">
                        <Badge
                          variant="outline"
                          className={
                            a.outcome === 'SUCCESS'
                              ? 'border-emerald-500/40 text-emerald-500 text-[9px] px-1.5'
                              : a.outcome === 'DENIED'
                              ? 'border-amber-500/40 text-amber-500 text-[9px] px-1.5'
                              : 'border-destructive/40 text-destructive text-[9px] px-1.5'
                          }
                        >
                          {a.outcome}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <code className="text-[10px] font-mono text-muted-foreground">{a.requestId.slice(0, 16)}…</code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
