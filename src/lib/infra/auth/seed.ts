/**
 * Idempotent seed: ensures the bootstrap user exists with the specified credentials.
 *
 * On Vercel serverless, the SQLite DB is ephemeral — we re-run this on every cold
 * start to make sure the demo user is always available. Locally it just runs once.
 *
 * The plaintext password is never stored — only the bcrypt hash.
 */

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/infra/auth/session';
import { workspaceService } from '@/lib/services/workspace';
import { audit } from '@/lib/infra/audit/audit';
import { AUDIT_ACTION } from '@/lib/domain/constants';
import { generateRequestKey } from '@/lib/infra/auth/api-key';

// Demo credentials — replace via the in-app "Change password" feature after first login.
const SEED_EMAIL = 'clodoaldo608@gmail.com';
const SEED_PASSWORD = '88677488';
const SEED_NAME = 'Clodoaldo';

let bootstrapPromise: Promise<void> | null = null;

export async function ensureSeedUser(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const existing = await db.user.findUnique({
        where: { email: SEED_EMAIL.toLowerCase() },
      });
      if (existing) return;

      const passwordHash = await hashPassword(SEED_PASSWORD);
      const user = await db.user.create({
        data: {
          email: SEED_EMAIL.toLowerCase(),
          name: SEED_NAME,
          passwordHash,
        },
      });

      const { workspaceId } = await workspaceService.createPersonalWorkspace({
        ownerId: user.id,
        ownerEmail: user.email,
        name: `Personal — ${SEED_NAME}`,
      });

      await audit.record({
        workspaceId,
        actorType: 'SYSTEM',
        actorId: user.id,
        actorName: user.email,
        action: AUDIT_ACTION.USER_REGISTER,
        requestId: generateRequestKey(),
        metadata: { seeded: true },
      });

      console.log('[seed] bootstrap user created:', SEED_EMAIL);
    } catch (err) {
      // Don't crash — just log. Idempotent so next request will retry.
      console.error('[seed] failed to create bootstrap user', err);
      bootstrapPromise = null;
    }
  })();
  return bootstrapPromise;
}
