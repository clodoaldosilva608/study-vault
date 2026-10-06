import { PrismaClient } from '@prisma/client'
import { SCHEMA_SQL } from '@/lib/db/schema-sql'

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
 * We apply the schema directly via raw SQL using the embedded SCHEMA_SQL string.
 * Idempotent — uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
 */
export async function ensureSchema(): Promise<void> {
  if (!process.env.VERCEL) return
  if (globalForPrisma.__dbReady) return globalForPrisma.__dbReady

  globalForPrisma.__dbReady = (async () => {
    try {
      const { promises: fs } = await import('fs')
      await fs.mkdir('/tmp', { recursive: true }).catch(() => null)

      // Split into individual statements (each ends with ';')
      // and remove SQL comments (lines starting with --).
      const statements = SCHEMA_SQL
        .split(/;\s*\n/)
        .map((s) =>
          s
            .split('\n')
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n')
            .trim(),
        )
        .filter((s) => s.length > 0)

      let applied = 0
      for (const stmt of statements) {
        try {
          await db.$executeRawUnsafe(stmt + ';')
          applied++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          if (!msg.includes('already exists')) {
            console.error('[db] stmt failed:', stmt.slice(0, 80), '->', msg.slice(0, 150))
          }
        }
      }
      console.log('[db] schema applied:', applied, 'statements')
    } catch (err) {
      console.error('[db] schema apply failed', err instanceof Error ? err.message : err)
      globalForPrisma.__dbReady = undefined
    }
  })()
  return globalForPrisma.__dbReady
}
