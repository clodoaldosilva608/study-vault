import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import { PLAN, PLAN_STORAGE, ROLE, AUDIT_ACTION } from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { generateRequestKey } from '@/lib/infra/auth/api-key';
import type { AuthContext } from '@/lib/infra/auth/session';

/**
 * Workspace service — bootstraps personal workspace on signup,
 * resolves membership context, manages usage counters.
 */
export const workspaceService = {
  async createPersonalWorkspace(params: {
    ownerId: string;
    ownerEmail: string;
    name?: string;
  }): Promise<{ workspaceId: string; membershipId: string }> {
    const slug = await generateUniqueSlug(params.ownerEmail);
    const workspace = await db.workspace.create({
      data: {
        name: params.name || `Personal — ${params.ownerEmail}`,
        slug,
        ownerId: params.ownerId,
        plan: PLAN.FREE,
        storageLimitBytes: PLAN_STORAGE.FREE,
        members: {
          create: {
            userId: params.ownerId,
            role: ROLE.OWNER,
          },
        },
        usageCounter: {
          create: {},
        },
      },
      include: { members: true },
    });

    const membership = workspace.members[0];
    await audit.record({
      workspaceId: workspace.id,
      actorType: 'USER',
      actorId: params.ownerId,
      actorName: params.ownerEmail,
      action: AUDIT_ACTION.WORKSPACE_CREATE,
      requestId: generateRequestKey(),
      metadata: { name: workspace.name, slug: workspace.slug },
    });

    return { workspaceId: workspace.id, membershipId: membership.id };
  },

  async getMembership(userId: string, workspaceId: string) {
    const m = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });
    if (!m) throw Errors.forbidden('Not a member of this workspace');
    return m;
  },

  async listMembers(ctx: AuthContext) {
    return db.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getUsage(ctx: AuthContext) {
    const usage = await db.usageCounter.findUnique({
      where: { workspaceId: ctx.workspaceId },
    });
    const workspace = await db.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { storageLimitBytes: true, plan: true },
    });
    if (!usage || !workspace) {
      return {
        storageUsedBytes: 0,
        storageLimitBytes: PLAN_STORAGE.FREE,
        filesCount: 0,
        foldersCount: 0,
        notesCount: 0,
      };
    }
    return {
      storageUsedBytes: usage.storageUsedBytes,
      storageLimitBytes: workspace.storageLimitBytes,
      filesCount: usage.filesCount,
      foldersCount: usage.foldersCount,
      notesCount: usage.notesCount,
    };
  },

  async recomputeUsage(workspaceId: string): Promise<void> {
    const [filesAgg, foldersAgg, notesAgg] = await Promise.all([
      db.file.aggregate({
        _sum: { sizeBytes: true },
        _count: { id: true },
        where: { workspaceId, deletedAt: null },
      }),
      db.folder.count({ where: { workspaceId, deletedAt: null } }),
      db.note.count({ where: { workspaceId, deletedAt: null } }),
    ]);
    await db.usageCounter.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        storageUsedBytes: filesAgg._sum.sizeBytes ?? 0,
        filesCount: filesAgg._count.id ?? 0,
        foldersCount,
        notesCount: notesAgg,
      },
      update: {
        storageUsedBytes: filesAgg._sum.sizeBytes ?? 0,
        filesCount: filesAgg._count.id ?? 0,
        foldersCount,
        notesCount: notesAgg,
      },
    });
  },
};

async function generateUniqueSlug(email: string): Promise<string> {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'workspace';
  let candidate = base;
  let attempt = 0;
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}
