'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SimpleDialog,
  SimpleDialogHeader,
  SimpleDialogTitle,
  SimpleDialogBody,
  SimpleDialogFooter,
  SimpleDialogClose,
} from '@/components/common/simple-dialog';
import { useAppStore } from '@/lib/store/app-store';
import { useTheme } from 'next-themes';
import { formatBytes } from '@/lib/utils/file';
import {
  User,
  Building2,
  HardDrive,
  Sun,
  Moon,
  Shield,
  LogOut,
  Database,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { simpleToast as toast } from '@/components/common/simple-toast';

type UsageResp = {
  storageUsedBytes: number;
  storageLimitBytes: number;
  filesCount: number;
  foldersCount: number;
  notesCount: number;
};

export function SettingsView() {
  const user = useAppStore((s) => s.user);
  const workspace = useAppStore((s) => s.workspace);
  const role = useAppStore((s) => s.role);
  const logout = useAppStore((s) => s.logout);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const { theme, setTheme } = useTheme();
  const [usage, setUsage] = useState<UsageResp | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    api.get<UsageResp>('/api/v1/workspaces/usage').then(setUsage).catch(() => null);
  }, []);

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-3xl mx-auto">
      {/* Profile */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{user?.name || 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowChangePwd(true)} className="gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Trocar senha
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </Card>

      {/* Workspace */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Workspace
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Name" value={workspace?.name} />
          <Field label="Slug" value={workspace?.slug} mono />
          <Field label="Plan" value={workspace?.plan} />
          <Field label="Your role" value={role} />
        </div>
      </Card>

      {/* Storage */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" /> Storage usage
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Field label="Used" value={usage ? formatBytes(usage.storageUsedBytes) : '—'} />
          <Field label="Limit" value={usage ? formatBytes(usage.storageLimitBytes) : '—'} />
          <Field label="Files" value={usage?.filesCount?.toString()} />
          <Field label="Folders" value={usage?.foldersCount?.toString()} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quota is enforced per workspace on every upload.
        </p>
      </Card>

      {/* Theme */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" /> Appearance
        </h3>
        <div className="flex gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('light')}
            className="gap-1.5"
          >
            <Sun className="h-3.5 w-3.5" /> Light
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('dark')}
            className="gap-1.5"
          >
            <Moon className="h-3.5 w-3.5" /> Dark
          </Button>
          <Button
            variant={theme === 'system' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('system')}
          >
            System
          </Button>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Security
        </h3>
        <ul className="text-xs space-y-2 text-muted-foreground">
          <li>• Auth via HTTP-only session cookies (JWT, 30-day TTL)</li>
          <li>• Passwords hashed with bcrypt (12 rounds)</li>
          <li>• Workspace-scoped authorization on every API route</li>
          <li>• JARVIS agent API keys are SHA-256 hashed at rest</li>
          <li>• Every sensitive operation writes to the audit log</li>
          <li>• Storage paths are server-generated — no path traversal possible</li>
          <li>• Changing password invalidates all other sessions</li>
        </ul>
        <Button variant="outline" size="sm" onClick={() => setShowChangePwd(true)} className="gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </Button>
      </Card>

      {/* Architecture */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> Architecture
        </h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Next.js 16 · App Router · TypeScript</div>
          <div>Prisma + SQLite (Postgres-ready for production)</div>
          <div>shadcn/ui · Tailwind v4 · TanStack Query</div>
          <div>PWA installable with manifest + service worker</div>
        </div>
      </Card>

      <ChangePasswordDialog
        open={showChangePwd}
        onOpenChange={setShowChangePwd}
        onSuccess={async () => {
          // Password changed → session cleared → re-bootstrap (will return to auth screen).
          await bootstrap();
        }}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void | Promise<void>;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post<{ message: string }>('/api/v1/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      toast.success(r.message || 'Password changed');
      reset();
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <SimpleDialogClose onClose={() => onOpenChange(false)} />
      <SimpleDialogHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <SimpleDialogTitle>Trocar senha</SimpleDialogTitle>
        </div>
      </SimpleDialogHeader>
      <SimpleDialogBody>
        <p className="text-xs text-muted-foreground mb-3">
          Digite sua senha atual e escolha uma nova. Todas as outras sessões
          serão encerradas.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pwd">Senha atual</Label>
            <Input
              id="cur-pwd"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nova senha</Label>
            <Input
              id="new-pwd"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
            <Input
              id="confirm-pwd"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <SimpleDialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !current || !next || !confirm || next !== confirm}
              className="gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Trocar senha
            </Button>
          </SimpleDialogFooter>
        </form>
      </SimpleDialogBody>
    </SimpleDialog>
  );
}
