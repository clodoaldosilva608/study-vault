'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Simple, portal-free toast system.
 *
 * Replaces Sonner which uses React Portals (causing removeChild errors).
 * Toasts render inline in a fixed-position container.
 *
 * Usage:
 *   import { simpleToast } from '@/components/common/simple-toast';
 *   simpleToast.success('Pasta criada');
 *   simpleToast.error('Falha ao criar');
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

let toastId = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let currentToasts: Toast[] = [];

function notify() {
  for (const listener of listeners) {
    listener([...currentToasts]);
  }
}

function addToast(type: ToastType, message: string) {
  const id = ++toastId;
  currentToasts = [...currentToasts, { id, type, message }];
  notify();

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

function removeToast(id: number) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notify();
}

export const simpleToast = {
  success: (msg: string) => addToast('success', msg),
  error: (msg: string) => addToast('error', msg),
  info: (msg: string) => addToast('info', msg),
  warning: (msg: string) => addToast('warning', msg),
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastType, string> = {
  success: 'text-emerald-500',
  error: 'text-destructive',
  info: 'text-blue-500',
  warning: 'text-amber-500',
};

export function SimpleToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToasts(newToasts);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className="flex items-start gap-2 p-3 rounded-md border border-border bg-card shadow-lg text-sm animate-in slide-in-from-right"
          >
            <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', COLORS[toast.type])} />
            <span className="flex-1 break-words">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
