/**
 * Study Vault — Prisma Client (server-only, bundler-safe)
 *
 * Uses eval('require') with absolute path to prevent the bundler from
 * tracing the @prisma/client import. This ensures Prisma Client NEVER
 * appears in client-side JavaScript bundles.
 *
 * The absolute path is needed because eval('require') resolves from
 * the current module's directory, which may not have node_modules.
 */

type PrismaLike = Record<string, any>;

let _dbInstance: PrismaLike | null = null;

function getDbInstance(): PrismaLike | null {
  // Only run on server
  if (typeof window !== 'undefined') return null;

  if (!_dbInstance) {
    try {
      // Build absolute path to @prisma/client
      // On Vercel: process.cwd() = /var/task
      // Locally: process.cwd() = project root
      const path = eval('require')('path');
      const prismaClientPath = path.join(
        process.cwd(),
        'node_modules',
        '@prisma',
        'client'
      );

      // eval('require') prevents the bundler from tracing this import
      const mod = eval('require')(prismaClientPath);
      const PrismaClient = mod.PrismaClient || mod.default?.PrismaClient || mod.default;

      _dbInstance = new PrismaClient({
        log: ['error', 'warn'],
      });

      // Cache on globalThis for warm instance reuse
      const g = globalThis as any;
      if (g.__prismaClient) {
        _dbInstance = g.__prismaClient;
      } else {
        g.__prismaClient = _dbInstance;
      }

      console.log('[db] PrismaClient initialized');
    } catch (err) {
      console.error('[db] failed to initialize PrismaClient:', err instanceof Error ? err.message : err);
      return null;
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
