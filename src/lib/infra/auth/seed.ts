/**
 * Idempotent seed: ensures the bootstrap user exists with DETERMINISTIC IDs.
 *
 * On Vercel serverless, each function invocation may have a fresh /tmp DB.
 * By using fixed IDs (instead of random CUIDs), the same user/workspace
 * exists across ALL instances — so a JWT issued by instance A is valid
 * when verified by instance B.
 */

import { db, ensureSchema } from '@/lib/db';
import { hashPassword } from '@/lib/infra/auth/password';
import { audit } from '@/lib/infra/audit/audit';
import {
  AUDIT_ACTION,
  PLAN,
  ROLE,
} from '@/lib/domain/constants';
import { generateRequestKey } from '@/lib/infra/auth/api-key';

// Demo credentials — override via env vars or change-password after first login.
const SEED_EMAIL = process.env.SEED_EMAIL || 'clodoaldo608@gmail.com';
const SEED_PASSWORD = process.env.SEED_PASSWORD || '88677488';
const SEED_NAME = process.env.SEED_NAME || 'Clodoaldo';

// DETERMINISTIC IDs — same across all serverless instances.
// This is the key fix: when instance A creates the seed user with these IDs,
// the JWT it issues contains these IDs. When instance B receives the JWT,
// ensureSeedUser() recreates the same user with the same IDs, so the JWT's
// sub matches a real user in instance B's DB.
const SEED_USER_ID = 'seed_user_clodoaldo_0001';
const SEED_WORKSPACE_ID = 'seed_workspace_clodoaldo_0001';
const SEED_SLUG = 'clodoaldo608';

let bootstrapPromise: Promise<void> | null = null;

export async function ensureSeedUser(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      // On Vercel cold start, the SQLite file is fresh — apply schema first.
      await ensureSchema();

      // Check by email (covers the case where the row exists with a different ID).
      const existingByEmail = await db.user.findUnique({
        where: { email: SEED_EMAIL.toLowerCase() },
      });
      if (existingByEmail) {
        // User exists — nothing to do.
        return;
      }

      const passwordHash = await hashPassword(SEED_PASSWORD);

      // Create user with FIXED ID.
      await db.user.create({
        data: {
          id: SEED_USER_ID,
          email: SEED_EMAIL.toLowerCase(),
          name: SEED_NAME,
          passwordHash,
        },
      });

      // Create workspace with FIXED ID + Owner membership + usage counter.
      await db.workspace.create({
        data: {
          id: SEED_WORKSPACE_ID,
          name: `Personal — ${SEED_NAME}`,
          slug: SEED_SLUG,
          ownerId: SEED_USER_ID,
          plan: PLAN.FREE,
          storageLimitBytes: 1073741824, // 1 GB
          members: {
            create: {
              userId: SEED_USER_ID,
              role: ROLE.OWNER,
            },
          },
          usageCounter: {
            create: {},
          },
        },
      });

      await audit.record({
        workspaceId: SEED_WORKSPACE_ID,
        actorType: 'SYSTEM',
        actorId: SEED_USER_ID,
        actorName: SEED_EMAIL,
        action: AUDIT_ACTION.USER_REGISTER,
        requestId: generateRequestKey(),
        metadata: { seeded: true },
      });

      console.log('[seed] bootstrap user created:', SEED_EMAIL, 'id:', SEED_USER_ID);
    } catch (err) {
      // Don't crash — just log. Idempotent so next request will retry.
      console.error('[seed] failed to create bootstrap user', err);
      bootstrapPromise = null;
    }
  })();
  return bootstrapPromise;
}

export function isSeedUser(userId: string): boolean {
  return userId === SEED_USER_ID;
}

export function getSeedUserInfo() {
  return {
    userId: SEED_USER_ID,
    workspaceId: SEED_WORKSPACE_ID,
    email: SEED_EMAIL.toLowerCase(),
    name: SEED_NAME,
    role: ROLE.OWNER,
  };
}
