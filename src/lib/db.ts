import { PrismaClient } from '@prisma/client'
import { SCHEMA_SQL } from '@/lib/db/schema-sql'
import { promises as fs } from 'fs'

// On Vercel serverless, the filesystem is read-only except for /tmp.
// We persist the SQLite DB there. Note: data is ephemeral per warm instance.
const DEFAULT_DB_PATH =
  process.env.VERCEL
    ? 'file:/tmp/study-vault.db'
    : 'file:/home/z/my-project/db/custom.db'

const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DB_PATH
const DB_FILE_PATH = DATABASE_URL.replace(/^file:/, '')

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
 * We apply the schema via raw SQL (embedded as SCHEMA_SQL string).
 * Idempotent — uses CREATE TABLE IF NOT EXISTS.
 *
 * NOTE: Blob sync removed — it was causing 403 errors and slowing every
 * request by ~500ms. Data is ephemeral per warm serverless instance.
 * The catch-all route ensures all requests share the same /tmp within
 * a warm session. The seed user is recreated on every cold start with
 * deterministic IDs.
 */
export async function ensureSchema(): Promise<void> {
  if (!process.env.VERCEL) return
  if (globalForPrisma.__dbReady) return globalForPrisma.__dbReady

  globalForPrisma.__dbReady = (async () => {
    try {
      await fs.mkdir('/tmp', { recursive: true }).catch(() => null)

      // Apply schema (idempotent — CREATE TABLE IF NOT EXISTS)
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

/**
 * No-op — blob sync removed to fix 403 errors and improve performance.
 * Kept for backward compatibility with the catch-all route.
 */
export async function syncDbFromBlob(): Promise<void> {
  return
}

/**
 * No-op — blob upload removed to fix 403 errors.
 * Kept for backward compatibility with the catch-all route.
 */
export async function persistDbToBlob(): Promise<void> {
  return
}
