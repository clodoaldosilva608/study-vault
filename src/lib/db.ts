/**
 * Study Vault — Prisma Client (server-only)
 *
 * The 'server-only' import causes a BUILD ERROR if this module
 * is ever included in a client-side bundle. This is the official
 * Next.js way to enforce server-only code.
 */

import 'server-only';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

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
