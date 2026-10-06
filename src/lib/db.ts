import { PrismaClient } from '@prisma/client'

// On Vercel serverless, the filesystem is read-only except for /tmp.
// We persist the SQLite DB there. Note: data is ephemeral per warm instance.
// For production, switch DATABASE_URL to a managed Postgres connection string.
const DEFAULT_DB_PATH =
  process.env.VERCEL
    ? 'file:/tmp/study-vault.db'
    : 'file:/home/z/my-project/db/custom.db'

const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DB_PATH

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __dbUrl?: string
  __dbReady?: Promise<void> | undefined
}

// Recreate the client if the URL has changed (e.g. env switch).
if (globalForPrisma.prisma && globalForPrisma.__dbUrl !== DATABASE_URL) {
  try { globalForPrisma.prisma?.$disconnect() } catch { /* ignore */ }
  globalForPrisma.prisma = undefined
  globalForPrisma.__dbReady = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: DATABASE_URL } },
  })

globalForPrisma.__dbUrl = DATABASE_URL
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * On Vercel serverless, the SQLite file in /tmp is empty on cold start.
 * We need to apply the Prisma schema (CREATE TABLE statements) before any
 * query can run. We do this lazily on the first DB operation via a module-level
 * promise that's shared across the warm instance.
 *
 * This uses `prisma db push` under the hood, which is idempotent.
 */
export async function ensureSchema(): Promise<void> {
  if (!process.env.VERCEL) return  // local dev already has schema applied via `bun run db:push`
  if (globalForPrisma.__dbReady) return globalForPrisma.__dbReady

  globalForPrisma.__dbReady = (async () => {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const { promises: fs } = await import('fs')
      const execAsync = promisify(exec)

      // Make sure /tmp exists
      await fs.mkdir('/tmp', { recursive: true }).catch(() => null)

      // Apply the schema. Idempotent.
      await execAsync('node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss', {
        cwd: '/var/task',
        timeout: 30_000,
        env: { ...process.env, DATABASE_URL },
      })
      console.log('[db] schema applied via prisma db push')
    } catch (err) {
      console.error('[db] schema push failed', err instanceof Error ? err.message : err)
      // Allow retry on next cold start.
      globalForPrisma.__dbReady = undefined
    }
  })()
  return globalForPrisma.__dbReady
}
