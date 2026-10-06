/**
 * Idempotent seed: ensures the bootstrap user + PRF folder structure exist
 * with DETERMINISTIC IDs.
 *
 * On Vercel serverless, each function invocation may have a fresh /tmp DB.
 * By using fixed IDs (instead of random CUIDs), the same user/workspace/folders
 * exist across ALL instances — so a JWT issued by instance A is valid
 * when verified by instance B.
 *
 * The PRF folder structure (14 subjects) is also seeded so the user always
 * has their study materials organized on every cold start.
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
const SEED_USER_ID = 'seed_user_clodoaldo_0001';
const SEED_WORKSPACE_ID = 'seed_workspace_clodoaldo_0001';
const SEED_SLUG = 'clodoaldo608';

// PRF folder structure — also seeded on every cold start
const PRF_FOLDER_ID = 'seed_folder_prf_0001';

const PRF_SUBJECTS: { name: string; id: string }[] = [
  { name: 'Língua Portuguesa', id: 'seed_folder_prf_portugues' },
  { name: 'Matemática', id: 'seed_folder_prf_matematica' },
  { name: 'Raciocínio Lógico', id: 'seed_folder_prf_raciocinio' },
  { name: 'Informática', id: 'seed_folder_prf_informatica' },
  { name: 'Direito Constitucional', id: 'seed_folder_prf_constitucional' },
  { name: 'Direito Administrativo', id: 'seed_folder_prf_administrativo' },
  { name: 'Direito Penal', id: 'seed_folder_prf_penal' },
  { name: 'Direito Processual Penal', id: 'seed_folder_prf_proc_penal' },
  { name: 'Direito Civil', id: 'seed_folder_prf_civil' },
  { name: 'Direitos Humanos', id: 'seed_folder_prf_direitos_humanos' },
  { name: 'Legislação Especial', id: 'seed_folder_prf_leg_especial' },
  { name: 'Legislação da PRF', id: 'seed_folder_prf_leg_prf' },
  { name: 'Noções de Criminologia', id: 'seed_folder_prf_criminologia' },
  { name: 'Atualidades', id: 'seed_folder_prf_atualidades' },
];

let bootstrapPromise: Promise<void> | null = null;

export async function ensureSeedUser(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      // On Vercel cold start, the SQLite file is fresh — apply schema first.
      await ensureSchema();

      // ---- USER ----
      const existingByEmail = await db.user.findUnique({
        where: { email: SEED_EMAIL.toLowerCase() },
      });
      if (!existingByEmail) {
        const passwordHash = await hashPassword(SEED_PASSWORD);

        await db.user.create({
          data: {
            id: SEED_USER_ID,
            email: SEED_EMAIL.toLowerCase(),
            name: SEED_NAME,
            passwordHash,
          },
        });

        await db.workspace.create({
          data: {
            id: SEED_WORKSPACE_ID,
            name: `Personal — ${SEED_NAME}`,
            slug: SEED_SLUG,
            ownerId: SEED_USER_ID,
            plan: PLAN.FREE,
            storageLimitBytes: 1073741824,
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

        console.log('[seed] bootstrap user created:', SEED_EMAIL);
      }

      // ---- PRF FOLDER STRUCTURE ----
      // Always check and create the PRF folder + subjects (idempotent).
      const prfFolder = await db.folder.findUnique({
        where: { id: PRF_FOLDER_ID },
      });
      if (!prfFolder) {
        // Create root PRF folder
        await db.folder.create({
          data: {
            id: PRF_FOLDER_ID,
            workspaceId: SEED_WORKSPACE_ID,
            parentId: null,
            name: 'PRF - Polícia Rodoviária Federal',
            path: '/PRF - Polícia Rodoviária Federal',
            createdBy: SEED_USER_ID,
          },
        });
        console.log('[seed] PRF root folder created');
      }

      // Create subject subfolders
      for (const subject of PRF_SUBJECTS) {
        const existing = await db.folder.findUnique({
          where: { id: subject.id },
        });
        if (!existing) {
          await db.folder.create({
            data: {
              id: subject.id,
              workspaceId: SEED_WORKSPACE_ID,
              parentId: PRF_FOLDER_ID,
              name: subject.name,
              path: `/PRF - Polícia Rodoviária Federal/${subject.name}`,
              createdBy: SEED_USER_ID,
            },
          });
        }
      }
      console.log('[seed] PRF subject folders ensured');

      // Update usage counter
      const foldersCount = await db.folder.count({
        where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null },
      });
      await db.usageCounter.upsert({
        where: { workspaceId: SEED_WORKSPACE_ID },
        create: { workspaceId: SEED_WORKSPACE_ID, foldersCount },
        update: { foldersCount },
      });
    } catch (err) {
      // Don't crash — just log. Idempotent so next request will retry.
      console.error('[seed] failed:', err instanceof Error ? err.message : err);
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
