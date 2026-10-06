import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import { AUDIT_ACTION, RESOURCE_TYPE } from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import type { AuthContext } from '@/lib/infra/auth/session';

export const noteService = {
  async list(ctx: AuthContext, opts: {
    folderId?: string | null;
    includeDeleted?: boolean;
    page?: number;
    pageSize?: number;
    query?: string;
  } = {}): Promise<{ items: any[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 25);
    const where: any = { workspaceId: ctx.workspaceId };
    if (!opts.includeDeleted) where.deletedAt = null;
    if (opts.folderId !== undefined) where.folderId = opts.folderId;
    if (opts.query) where.title = { contains: opts.query };

    const [items, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { folder: { select: { id: true, name: true } } },
      }),
      db.note.count({ where }),
    ]);
    return { items, total };
  },

  async get(ctx: AuthContext, id: string) {
    const note = await db.note.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      include: { folder: true },
    });
    if (!note) throw Errors.notFound('Note');
    return note;
  },

  async create(ctx: AuthContext, params: {
    title: string;
    content: string;
    folderId?: string | null;
    tags?: string[];
  }): Promise<any> {
    if (!params.title || params.title.trim().length === 0) {
      throw Errors.badRequest('Note title is required');
    }
    if (params.folderId) {
      const folder = await db.folder.findFirst({
        where: { id: params.folderId, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!folder) throw Errors.notFound('Folder');
    }

    const note = await db.note.create({
      data: {
        workspaceId: ctx.workspaceId,
        folderId: params.folderId ?? null,
        title: params.title,
        content: params.content || '',
        format: 'markdown',
        tags: JSON.stringify(params.tags ?? []),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      },
    });

    await db.usageCounter.update({
      where: { workspaceId: ctx.workspaceId },
      data: { notesCount: { increment: 1 } },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.CREATE_NOTE,
      resourceType: RESOURCE_TYPE.NOTE,
      resourceId: note.id,
      requestId: ctx.requestId,
      metadata: { title: note.title },
    });

    return note;
  },

  async update(ctx: AuthContext, id: string, params: {
    title?: string;
    content?: string;
    folderId?: string | null;
    tags?: string[];
  }): Promise<any> {
    const note = await db.note.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!note) throw Errors.notFound('Note');

    const data: any = { updatedBy: ctx.user.id, updatedAt: new Date() };
    if (params.title !== undefined) data.title = params.title;
    if (params.content !== undefined) data.content = params.content;
    if (params.folderId !== undefined) {
      if (params.folderId) {
        const folder = await db.folder.findFirst({
          where: { id: params.folderId, workspaceId: ctx.workspaceId, deletedAt: null },
        });
        if (!folder) throw Errors.notFound('Folder');
      }
      data.folderId = params.folderId;
    }
    if (params.tags !== undefined) data.tags = JSON.stringify(params.tags);

    const updated = await db.note.update({ where: { id: note.id }, data });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.UPDATE_NOTE,
      resourceType: RESOURCE_TYPE.NOTE,
      resourceId: note.id,
      requestId: ctx.requestId,
    });

    return updated;
  },

  async softDelete(ctx: AuthContext, id: string) {
    const note = await db.note.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!note) throw Errors.notFound('Note');

    await db.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.DELETE_NOTE,
      resourceType: RESOURCE_TYPE.NOTE,
      resourceId: note.id,
      requestId: ctx.requestId,
    });

    await db.usageCounter.update({
      where: { workspaceId: ctx.workspaceId },
      data: { notesCount: { decrement: 1 } },
    });
  },
};
