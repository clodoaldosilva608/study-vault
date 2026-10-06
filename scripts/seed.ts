/**
 * Manual seed script — `bun run scripts/seed.ts`
 * Idempotently creates the demo user + their personal workspace.
 */
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/infra/auth/session';
import { workspaceService } from '../src/lib/services/workspace';
import { audit } from '../src/lib/infra/audit/audit';
import { AUDIT_ACTION } from '../src/lib/domain/constants';
import { generateRequestKey } from '../src/lib/infra/auth/api-key';

const SEED_EMAIL = process.env.SEED_EMAIL || 'clodoaldo608@gmail.com';
const SEED_PASSWORD = process.env.SEED_PASSWORD || '88677488';
const SEED_NAME = process.env.SEED_NAME || 'Clodoaldo';

async function main() {
  console.log(`[seed] ensuring user ${SEED_EMAIL} exists...`);
  const existing = await db.user.findUnique({
    where: { email: SEED_EMAIL.toLowerCase() },
  });
  if (existing) {
    console.log('[seed] user already exists, skipping');
    return;
  }
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
    metadata: { seeded: true, source: 'seed-script' },
  });
  console.log(`[seed] user created: ${user.email} (workspace: ${workspaceId})`);
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
