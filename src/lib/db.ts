import { PrismaClient } from '@prisma/client'

/**
 * Study Vault — Prisma Client
 *
 * Uses PostgreSQL (Supabase) as the persistent database.
 * No more ephemeral SQLite, no blob sync, no schema bootstrap.
 * The schema is applied via `prisma db push` or `prisma migrate`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * No-op on Postgres — the schema is applied via migrations.
 * Kept for backward compatibility with the catch-all route.
 */
export async function ensureSchema(): Promise<void> {
  return
}

/**
 * No-op on Postgres — data is persistent, no blob sync needed.
 * Kept for backward compatibility with the catch-all route.
 */
export async function syncDbFromBlob(): Promise<void> {
  return
}

/**
 * No-op on Postgres — data is automatically committed.
 * Kept for backward compatibility with the catch-all route.
 */
export async function persistDbToBlob(): Promise<void> {
  return
}
