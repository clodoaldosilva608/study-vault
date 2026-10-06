'use client';

import { useState } from 'react';
import { Vault, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Layers, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';

export function AuthScreen() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // ---- login state ----
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ---- register state ----
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await api.post('/api/v1/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });
      await bootstrap();
      toast.success('Welcome back!');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    try {
      await api.post('/api/v1/auth/register', {
        email: regEmail,
        password: regPassword,
        name: regName || undefined,
      });
      await bootstrap();
      toast.success('Account created — your workspace is ready.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed';
      toast.error(msg);
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Brand panel */}
      <aside className="lg:flex-1 bg-sidebar border-r border-sidebar-border p-8 lg:p-12 flex flex-col justify-between min-h-[35vh] lg:min-h-screen">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/25">
            <Vault className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">Study Vault</span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Personal knowledge infrastructure
            </span>
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-6 py-12">
          <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight text-balance">
            Your study archive, engineered like infrastructure.
          </h1>
          <p className="text-muted-foreground text-base max-w-md leading-relaxed">
            Multi-tenant, audit-logged, secure-by-default. Files, notes, and a
            clean tool layer ready for JARVIS to plug into.
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Workspace-scoped authorization with full audit trail
            </li>
            <li className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-primary" />
              Folders, files, notes, Obsidian import/export foundation
            </li>
            <li className="flex items-center gap-3">
              <Bot className="h-4 w-4 text-primary" />
              JARVIS agent API with explicit scopes per tool
            </li>
          </ul>
        </div>

        <div className="text-[11px] text-muted-foreground font-mono">
          v0.1.0 · MVP foundation
        </div>
      </aside>

      {/* Form panel */}
      <main className="lg:flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="p-6 border-border/70 shadow-sm">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="pl-9"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loginLoading}>
                    {loginLoading ? 'Signing in…' : 'Sign in'}
                    {!loginLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              </Card>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Don&apos;t have an account?{' '}
                <button
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                  onClick={() => setTab('register')}
                >
                  Create one
                </button>
              </p>
            </TabsContent>

            <TabsContent value="register">
              <Card className="p-6 border-border/70 shadow-sm">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Name (optional)</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Your name"
                        className="pl-9"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="pl-9"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="pl-9"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      A personal workspace is created automatically on signup.
                    </p>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={regLoading}>
                    {regLoading ? 'Creating account…' : 'Create account'}
                    {!regLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              </Card>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Already have an account?{' '}
                <button
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                  onClick={() => setTab('login')}
                >
                  Sign in
                </button>
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
