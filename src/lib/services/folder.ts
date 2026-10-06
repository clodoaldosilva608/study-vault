import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import { AUDIT_ACTION, RESOURCE_TYPE } from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { workspaceService } from './workspace';
import type { AuthContext } from '@/lib/infra/auth/session';

const INVALID_NAME_PATTERN = /[/\\:*?"<>|\u0000-\u001F]/;
const MAX_NAME_LEN = 200;

export const folderService = {
  async list(ctx: AuthContext, opts: {
    parentId?: string | null;
    includeDeleted?: boolean;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 100);

    const where: any = { workspaceId: ctx.workspaceId };
    if (!opts.includeDeleted) where.deletedAt = null;

    if (opts.parentId === undefined) {
      // root
    } else if (opts.parentId === null) {
      where.parentId = null;
    } else {
      where.parentId = opts.parentId;
    }

    const [items, total] = await Promise.all([
      db.folder.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { files: { where: { deletedAt: null } }, children: { where: { deletedAt: null } } } },
        },
      }),
      db.folder.count({ where }),
    ]);

    return { items, total };
  },

  async get(ctx: AuthContext, id: string) {
    const folder = await db.folder.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      include: {
        parent: true,
        children: { where: { deletedAt: null } },
        _count: { select: { files: { where: { deletedAt: null } } } },
      },
    });
    if (!folder) throw Errors.notFound('Folder');
    return folder;
  },

  async create(ctx: AuthContext, params: {
    name: string;
    parentId?: string | null;
  }): Promise<any> {
    validateName(params.name);
    const parentId = params.parentId ?? null;
    let parentPath = '/';
    if (parentId) {
      const parent = await db.folder.findFirst({
        where: { id: parentId, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!parent) throw Errors.notFound('Parent folder');
      await assertNoCycle(parentId, parentId);
      // parent.path already includes the parent's own name; we just append the new folder's name.
      parentPath = parent.path.endsWith('/')
        ? parent.path
        : `${parent.path}/`;
    }
    const path = parentPath + params.name;

    // Idempotency: check existing same name+parent+undeleted
    const existing = await db.folder.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        parentId,
        name: params.name,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const folder = await db.folder.create({
      data: {
        workspaceId: ctx.workspaceId,
        parentId,
        name: params.name,
        path,
        createdBy: ctx.user.id,
      },
    });

    await db.usageCounter.update({
      where: { workspaceId: ctx.workspaceId },
      data: { foldersCount: { increment: 1 } },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.CREATE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.requestId,
      metadata: { name: folder.name, parentId },
    });

    return folder;
  },

  async rename(ctx: AuthContext, id: string, name: string) {
    validateName(name);
    const folder = await db.folder.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!folder) throw Errors.notFound('Folder');

    const newPath = folder.path.slice(0, folder.path.length - folder.name.length) + name;
    const updated = await db.folder.update({
      where: { id: folder.id },
      data: { name, path: newPath, updatedAt: new Date() },
    });

    // Cascade path updates to descendants
    await cascadePathUpdate(folder.id, folder.path, newPath);

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.UPDATE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.requestId,
      metadata: { from: folder.name, to: name },
    });

    return updated;
  },

  async move(ctx: AuthContext, id: string, newParentId: string | null) {
    const folder = await db.folder.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!folder) throw Errors.notFound('Folder');
    if (id === newParentId) throw Errors.badRequest('Cannot move folder into itself');

    // Cycle detection: walk up from new parent
    if (newParentId) {
      const cycle = await detectCycle(newParentId, id);
      if (cycle) throw Errors.badRequest('Cannot move folder into its own descendant');
    }

    let newPath = '/';
    if (newParentId) {
      const parent = await db.folder.findFirst({
        where: { id: newParentId, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!parent) throw Errors.notFound('Parent folder');
      newPath = parent.path.endsWith('/')
        ? parent.path
        : `${parent.path}/`;
    }
    newPath = newPath + folder.name;

    await db.folder.update({
      where: { id: folder.id },
      data: { parentId: newParentId, path: newPath, updatedAt: new Date() },
    });

    await cascadePathUpdate(folder.id, folder.path, newPath);

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.MOVE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.requestId,
      metadata: { from: folder.parentId, to: newParentId },
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async softDelete(ctx: AuthContext, id: string) {
    const folder = await db.folder.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!folder) throw Errors.notFound('Folder');

    const now = new Date();
    await db.folder.update({
      where: { id: folder.id },
      data: { deletedAt: now },
    });

    // Cascade soft delete descendants + files in subtree
    await db.folder.updateMany({
      where: { workspaceId: ctx.workspaceId, path: { startsWith: folder.path } },
      data: { deletedAt: now },
    });
    await db.file.updateMany({
      where: { workspaceId: ctx.workspaceId, folder: { path: { startsWith: folder.path } } },
      data: { deletedAt: now },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.DELETE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.requestId,
      metadata: { name: folder.name },
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async restore(ctx: AuthContext, id: string) {
    const folder = await db.folder.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: { not: null } },
    });
    if (!folder) throw Errors.notFound('Folder in trash');

    await db.folder.update({
      where: { id: folder.id },
      data: { deletedAt: null },
    });
    await db.folder.updateMany({
      where: { workspaceId: ctx.workspaceId, path: { startsWith: folder.path }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    await db.file.updateMany({
      where: { workspaceId: ctx.workspaceId, folder: { path: { startsWith: folder.path } } },
      data: { deletedAt: null },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.RESTORE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.requestId,
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },
};

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw Errors.badRequest('Folder name is required');
  }
  if (name.length > MAX_NAME_LEN) {
    throw Errors.badRequest(`Folder name too long (max ${MAX_NAME_LEN})`);
  }
  if (INVALID_NAME_PATTERN.test(name)) {
    throw Errors.badRequest('Folder name contains invalid characters');
  }
  if (name === '.' || name === '..') {
    throw Errors.badRequest('Invalid folder name');
  }
}

async function assertNoCycle(_folderId: string, _ancestorId: string): Promise<void> {
  // reserved for future cycle detection scenarios
}

async function detectCycle(startId: string, forbiddenAncestorId: string): Promise<boolean> {
  let currentId: string | null = startId;
  while (currentId) {
    if (currentId === forbiddenAncestorId) return true;
    const current = await db.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = current?.parentId ?? null;
  }
  return false;
}

async function cascadePathUpdate(folderId: string, oldPath: string, newPath: string): Promise<void> {
  const descendants = await db.folder.findMany({
    where: { workspaceId: { not: '' }, path: { startsWith: oldPath } },
    select: { id: true, path: true },
  });
  for (const d of descendants) {
    if (d.id === folderId) continue;
    const updated = newPath + d.path.slice(oldPath.length);
    await db.folder.update({ where: { id: d.id }, data: { path: updated } });
  }
}
