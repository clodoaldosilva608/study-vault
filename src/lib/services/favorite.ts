import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  AUDIT_ACTION,
  RESOURCE_TYPE,
} from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import type { AuthContext } from '@/lib/infra/auth/session';

export const favoriteService = {
  async list(ctx: AuthContext) {
    return db.favorite.findMany({
      where: { workspaceId: ctx.workspaceId, userId: ctx.user.id },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            extension: true,
            mimeType: true,
            sizeBytes: true,
            updatedAt: true,
            folder: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async add(ctx: AuthContext, fileId: string) {
    const file = await db.file.findFirst({
      where: { id: fileId, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');

    const fav = await db.favorite.upsert({
      where: {
        workspaceId_fileId_userId: {
          workspaceId: ctx.workspaceId,
          fileId,
          userId: ctx.user.id,
        },
      },
      create: { workspaceId: ctx.workspaceId, fileId, userId: ctx.user.id },
      update: {},
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.FAVORITE_ADD,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: fileId,
      requestId: ctx.requestId,
    });

    return fav;
  },

  async remove(ctx: AuthContext, fileId: string) {
    await db.favorite.deleteMany({
      where: {
        workspaceId: ctx.workspaceId,
        fileId,
        userId: ctx.user.id,
      },
    });
    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.FAVORITE_REMOVE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: fileId,
      requestId: ctx.requestId,
    });
  },
};

export const recentService = {
  async list(ctx: AuthContext, opts: { page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 25);
    const [items, total] = await Promise.all([
      db.recentFile.findMany({
        where: { workspaceId: ctx.workspaceId, userId: ctx.user.id },
        orderBy: { accessedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          file: {
            select: {
              id: true,
              name: true,
              extension: true,
              mimeType: true,
              sizeBytes: true,
              folder: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.recentFile.count({
        where: { workspaceId: ctx.workspaceId, userId: ctx.user.id },
      }),
    ]);
    return { items, total };
  },

  async touch(ctx: AuthContext, fileId: string) {
    await db.recentFile.upsert({
      where: {
        workspaceId_fileId_userId: {
          workspaceId: ctx.workspaceId,
          fileId,
          userId: ctx.user.id,
        },
      },
      create: {
        workspaceId: ctx.workspaceId,
        fileId,
        userId: ctx.user.id,
      },
      update: { accessedAt: new Date() },
    });
  },
};
