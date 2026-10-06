import { PrismaClient } from '@prisma/client'
import { SCHEMA_SQL } from '@/lib/db/schema-sql'
import { promises as fs } from 'fs'
import { join } from 'path'

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
  __dbSynced?: boolean
}

// Recreate the client if the URL has changed (e.g. env switch).
if (globalForPrisma.prisma && globalForPrisma.__dbUrl !== DATABASE_URL) {
  try { globalForPrisma.prisma?.$disconnect() } catch { /* ignore */ }
  globalForPrisma.prisma = undefined
  globalForPrisma.__dbReady = undefined
  globalForPrisma.__dbSynced = false
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: DATABASE_URL } },
  })

globalForPrisma.__dbUrl = DATABASE_URL
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ---- Vercel Blob sync ----
// We persist the SQLite DB file to Vercel Blob so it survives cold starts
// and is shared across serverless function instances.
// On every cold start, we download the latest DB from Blob.
// After writes, we upload the updated DB to Blob.

const BLOB_KEY = 'study-vault-db.sqlite'
const SYNC_LOCK_FILE = '/tmp/.study-vault-db-synced'

async function downloadDbFromBlob(): Promise<void> {
  if (!process.env.VERCEL) return

  try {
    const { list } = await import('@vercel/blob')
    // Check if the blob exists
    const blobs = await list({ prefix: BLOB_KEY, limit: 1 })
    if (blobs.blobs.length === 0) {
      console.log('[db] no existing blob DB found — starting fresh')
      return
    }

    const blobUrl = blobs.blobs[0].url
    console.log('[db] downloading DB from blob:', blobUrl)

    const response = await fetch(blobUrl)
    if (!response.ok) {
      console.error('[db] blob download failed:', response.status)
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(DB_FILE_PATH, buffer)
    console.log('[db] DB downloaded from blob, size:', buffer.length)
  } catch (err) {
    // Token might not be available — app still works with ephemeral SQLite.
    console.error('[db] blob download error (app will use ephemeral DB):', err instanceof Error ? err.message : err)
  }
}

let uploadTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Upload the SQLite DB to Vercel Blob. Called after writes.
 * Debounced — multiple writes within 2 seconds are batched into one upload.
 */
export async function persistDbToBlob(): Promise<void> {
  if (!process.env.VERCEL) return

  // Debounce: wait 2 seconds before uploading, in case more writes come in.
  if (uploadTimer) clearTimeout(uploadTimer)

  return new Promise((resolve) => {
    uploadTimer = setTimeout(async () => {
      try {
        const { put, list, del } = await import('@vercel/blob')
        // Read the local DB file
        const buffer = await fs.readFile(DB_FILE_PATH)

        // Delete old blob(s) first (Vercel Blob doesn't overwrite by key)
        try {
          const oldBlobs = await list({ prefix: BLOB_KEY, limit: 10 })
          for (const b of oldBlobs.blobs) {
            await del(b.url)
          }
        } catch { /* ignore */ }

        // Upload the new one
        await put(BLOB_KEY, buffer, {
          access: 'public',
          contentType: 'application/octet-stream',
        })
        console.log('[db] DB uploaded to blob, size:', buffer.length)
      } catch (err) {
        console.error('[db] blob upload error (app continues with ephemeral DB):', err instanceof Error ? err.message : err)
      }
      uploadTimer = null
      resolve()
    }, 2000)
  })
}

/**
 * On Vercel serverless, the SQLite file in /tmp is empty on cold start.
 * We download the latest DB from Vercel Blob, then apply the schema if needed.
 */
export async function ensureSchema(): Promise<void> {
  if (!process.env.VERCEL) return
  if (globalForPrisma.__dbReady) return globalForPrisma.__dbReady

  globalForPrisma.__dbReady = (async () => {
    try {
      await fs.mkdir('/tmp', { recursive: true }).catch(() => null)

      // Download the DB from Blob (if it exists)
      await downloadDbFromBlob()

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
