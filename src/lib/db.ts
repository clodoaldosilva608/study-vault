/**
 * Study Vault — Prisma Client (server-only, bundler-safe)
 *
 * Uses eval('require') to prevent the bundler (Turbopack/Webpack) from
 * tracing the @prisma/client import. This ensures Prisma Client NEVER
 * appears in client-side JavaScript bundles, fixing the 'M_ID' error.
 *
 * The Proxy pattern lazily creates the PrismaClient on first access,
 * only on the server where require() is available.
 */

type PrismaLike = Record<string, any>;

let _dbInstance: PrismaLike | null = null;

function getDbInstance(): PrismaLike | null {
  // Only run on server — require is not available in the browser
  if (typeof window !== 'undefined') return null;
  if (typeof require === 'undefined') return null;

  if (!_dbInstance) {
    // eval('require') prevents the bundler from seeing this import,
    // so @prisma/client is never included in client bundles.
    const mod = eval('require')('@prisma/client');
    const PrismaClient = mod.PrismaClient || mod.default?.PrismaClient || mod.default;
    _dbInstance = new PrismaClient({
      log: ['error', 'warn'],
    });

    // Cache on globalThis for HMR in dev
    const g = globalThis as any;
    if (process.env.NODE_ENV !== 'production') {
      if (!g.__prismaClient) g.__prismaClient = _dbInstance;
      else _dbInstance = g.__prismaClient;
    }
  }
  return _dbInstance;
}

/**
 * Proxy that forwards all property accesses to the real PrismaClient.
 * On the client, all accesses return undefined (no-op).
 * On the server, the PrismaClient is lazily created on first access.
 */
export const db = new Proxy({} as PrismaLike, {
  get(_target, prop: string) {
    const instance = getDbInstance();
    if (!instance) return undefined;
    const val = instance[prop];
    // Bind methods so `this` context is correct
    return typeof val === 'function' ? val.bind(instance) : val;
  },
}) as any;

// No-op functions for backward compatibility
export async function ensureSchema(): Promise<void> {
  return;
}

export async function syncDbFromBlob(): Promise<void> {
  return;
}

export async function persistDbToBlob(): Promise<void> {
  return;
}
