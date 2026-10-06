'use client';

import { Vault } from 'lucide-react';

export function BootScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
          <Vault className="h-7 w-7 text-primary" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        </div>
        <div className="text-sm text-muted-foreground font-mono tracking-wide">
          initializing study vault…
        </div>
      </div>
    </div>
  );
}
