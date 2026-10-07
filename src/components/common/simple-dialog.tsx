'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Simple, portal-free Dialog component.
 *
 * WHY: Radix UI's Dialog uses React Portals which render content into
 * document.body. When the parent re-renders while a dialog is open or
 * closing, React's reconciler tries to removeChild on nodes that were
 * moved to the portal, causing:
 *   "Failed to execute 'removeChild' on 'Node': The node to be removed
 *    is not a child of this node."
 *
 * This SimpleDialog renders inline (no portal) so React can safely
 * manage the DOM nodes during re-renders.
 */

type SimpleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

export function SimpleDialog({ open, onOpenChange, children, className }: SimpleDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Content — stops propagation so clicks inside don't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SimpleDialogHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between p-6 pb-2">
      {children}
    </div>
  );
}

export function SimpleDialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold">{children}</h2>;
}

export function SimpleDialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground mt-1 px-6 pb-2">{children}</p>;
}

export function SimpleDialogBody({ children }: { children: ReactNode }) {
  return <div className="px-6 py-4">{children}</div>;
}

export function SimpleDialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 p-6 pt-2 border-t border-border/50 mt-2">
      {children}
    </div>
  );
}

export function SimpleDialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Fechar"
      className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent transition-colors"
    >
      <X className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/**
 * Simple, portal-free Sheet (drawer) component.
 * Slides in from the specified side without using a portal.
 */
export function SimpleSheet({
  open,
  onOpenChange,
  side = 'left',
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'left' | 'right';
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute top-0 bottom-0 flex flex-col bg-sidebar border-sidebar-border shadow-xl transition-transform',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          'w-72',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
