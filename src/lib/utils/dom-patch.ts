'use client';

/**
 * Global DOM error suppression.
 *
 * Patches Node.prototype.removeChild to catch NotFoundError exceptions
 * and return null instead of throwing. This prevents the 'removeChild'
 * error from crashing React's reconciliation loop.
 *
 * This is a LAST RESORT fix for the persistent 'removeChild' error
 * caused by DOM manipulation conflicts (browser extensions, portals,
 * React hydration mismatches).
 */

let _patched = false;

export function patchRemoveChild() {
  if (_patched) return;
  if (typeof window === 'undefined') return;
  if (typeof Node === 'undefined') return;

  _patched = true;

  const originalRemoveChild = Node.prototype.removeChild;

  Node.prototype.removeChild = function<T extends Node>(child: T): T | null {
    try {
      return originalRemoveChild.call(this, child);
    } catch (err) {
      // If the node isn't a child of this parent, just return it
      // instead of throwing. This prevents React's reconciler from
      // crashing.
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return child;
      }
      throw err;
    }
  };

  // Also patch remove() on Element for the same reason
  const originalRemove = Element.prototype.remove;
  Element.prototype.remove = function () {
    try {
      return originalRemove.call(this);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return;
      }
      throw err;
    }
  };

  console.log('[dom-patch] removeChild patched to suppress NotFoundError');
}
