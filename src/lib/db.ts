import { PrismaClient } from '@prisma/client'
import { join } from 'path'

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
}

// Recreate the client if the URL has changed (e.g. env switch).
if (globalForPrisma.prisma && globalForPrisma.__dbUrl !== DATABASE_URL) {
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: DATABASE_URL } },
  })

globalForPrisma.__dbUrl = DATABASE_URL
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
