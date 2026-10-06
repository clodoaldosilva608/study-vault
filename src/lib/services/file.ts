import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  AUDIT_ACTION,
  MAX_FILE_SIZE_BYTES,
  RESOURCE_TYPE,
} from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { storage } from '@/lib/infra/storage/adapter';
import { workspaceService } from './workspace';
import type { AuthContext } from '@/lib/infra/auth/session';

const ALLOWED_MIME_PREFIXES = ['']; // MVP: allow any mime — quota + size are the limits

export const fileService = {
  async list(ctx: AuthContext, opts: {
    folderId?: string | null;
    includeDeleted?: boolean;
    page?: number;
    pageSize?: number;
    favoriteOnly?: boolean;
    extension?: string;
    mimeType?: string;
  } = {}): Promise<{ items: any[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 50);

    const where: any = { workspaceId: ctx.workspaceId };
    if (!opts.includeDeleted) where.deletedAt = null;
    if (opts.folderId !== undefined) {
      where.folderId = opts.folderId;
    }
    if (opts.extension) where.extension = opts.extension.toLowerCase();
    if (opts.mimeType) where.mimeType = { startsWith: opts.mimeType };
    if (opts.favoriteOnly) {
      where.favorites = { some: { userId: ctx.user.id } };
    }

    const [items, total] = await Promise.all([
      db.file.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          folder: { select: { id: true, name: true, path: true } },
          favorites: {
            where: { userId: ctx.user.id },
            select: { id: true },
          },
        },
      }),
      db.file.count({ where }),
    ]);

    return { items, total };
  },

  async get(ctx: AuthContext, id: string) {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      include: {
        folder: { select: { id: true, name: true, path: true } },
        favorites: { where: { userId: ctx.user.id }, select: { id: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });
    if (!file) throw Errors.notFound('File');
    return file;
  },

  async upload(ctx: AuthContext, params: {
    name: string;
    folderId?: string | null;
    bytes: Buffer;
    mimeType: string;
    sizeBytes: number;
  }): Promise<any> {
    if (params.sizeBytes <= 0) throw Errors.badRequest('Empty file');
    if (params.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw Errors.badRequest(
        `File too large (max ${MAX_FILE_SIZE_BYTES} bytes)`,
      );
    }

    // Quota check
    const usage = await workspaceService.getUsage(ctx);
    if (usage.storageUsedBytes + params.sizeBytes > usage.storageLimitBytes) {
      throw Errors.quotaExceeded(
        `Storage quota would be exceeded (${usage.storageUsedBytes}/${usage.storageLimitBytes} bytes used)`,
      );
    }

    if (ALLOWED_MIME_PREFIXES.length === 0) {
      throw Errors.badRequest('No MIME types allowed');
    }

    // Verify folder belongs to workspace if specified
    if (params.folderId) {
      const folder = await db.folder.findFirst({
        where: {
          id: params.folderId,
          workspaceId: ctx.workspaceId,
          deletedAt: null,
        },
      });
      if (!folder) throw Errors.notFound('Folder');
    }

    // Create file row first to get an id
    const ext = (params.name.split('.').pop() || '').toLowerCase().slice(0, 16);
    const file = await db.file.create({
      data: {
        workspaceId: ctx.workspaceId,
        folderId: params.folderId ?? null,
        name: params.name,
        originalName: params.name,
        storagePath: 'pending',
        mimeType: params.mimeType,
        extension: ext,
        sizeBytes: params.sizeBytes,
        version: 1,
        metadata: '{}',
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      },
    });

    // Save to storage
    const result = await storage.save(
      ctx.workspaceId,
      file.id,
      params.bytes,
      params.name,
    );

    const updated = await db.file.update({
      where: { id: file.id },
      data: {
        storagePath: result.storagePath,
        checksum: result.checksum,
      },
    });

    await db.fileVersion.create({
      data: {
        fileId: file.id,
        version: 1,
        storagePath: result.storagePath,
        sizeBytes: result.sizeBytes,
        checksum: result.checksum,
        createdBy: ctx.user.id,
      },
    });

    await db.usageCounter.update({
      where: { workspaceId: ctx.workspaceId },
      data: {
        storageUsedBytes: { increment: result.sizeBytes },
        filesCount: { increment: 1 },
      },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.UPLOAD_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: {
        name: params.name,
        sizeBytes: result.sizeBytes,
        mimeType: params.mimeType,
      },
    });

    return updated;
  },

  async getDownloadBuffer(ctx: AuthContext, id: string): Promise<{
    buffer: Buffer;
    file: any;
  }> {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');
    const buffer = await storage.read(file.storagePath);

    // Track recent
    await db.recentFile.upsert({
      where: {
        workspaceId_fileId_userId: {
          workspaceId: ctx.workspaceId,
          fileId: file.id,
          userId: ctx.user.id,
        },
      },
      create: {
        workspaceId: ctx.workspaceId,
        fileId: file.id,
        userId: ctx.user.id,
      },
      update: { accessedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.DOWNLOAD_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: { name: file.name, sizeBytes: file.sizeBytes },
    });

    return { buffer, file };
  },

  async rename(ctx: AuthContext, id: string, name: string) {
    if (!name || name.trim().length === 0) {
      throw Errors.badRequest('File name is required');
    }
    if (name.length > 200) throw Errors.badRequest('File name too long');

    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');

    const ext = (name.split('.').pop() || '').toLowerCase();
    const updated = await db.file.update({
      where: { id: file.id },
      data: { name, extension: ext, updatedBy: ctx.user.id, updatedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.UPDATE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: { from: file.name, to: name },
    });

    return updated;
  },

  async move(ctx: AuthContext, id: string, newFolderId: string | null) {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');
    if (newFolderId) {
      const folder = await db.folder.findFirst({
        where: { id: newFolderId, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!folder) throw Errors.notFound('Folder');
    }

    const updated = await db.file.update({
      where: { id: file.id },
      data: { folderId: newFolderId, updatedBy: ctx.user.id, updatedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.MOVE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: { from: file.folderId, to: newFolderId },
    });

    return updated;
  },

  async softDelete(ctx: AuthContext, id: string) {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');

    await db.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.DELETE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: { name: file.name },
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async restore(ctx: AuthContext, id: string) {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: { not: null } },
    });
    if (!file) throw Errors.notFound('File in trash');

    await db.file.update({
      where: { id: file.id },
      data: { deletedAt: null },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.RESTORE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async purge(ctx: AuthContext, id: string) {
    const file = await db.file.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!file) throw Errors.notFound('File');

    // Delete from storage
    await storage.delete(file.storagePath);

    await db.file.delete({ where: { id: file.id } });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.PURGE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.requestId,
      metadata: { name: file.name, sizeBytes: file.sizeBytes },
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async emptyTrash(ctx: AuthContext) {
    const files = await db.file.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: { not: null } },
      select: { id: true, storagePath: true, name: true, sizeBytes: true },
    });
    for (const f of files) {
      try { await storage.delete(f.storagePath); } catch { /* ignore */ }
    }
    await db.file.deleteMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: { not: null } },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.PURGE_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: 'trash',
      requestId: ctx.requestId,
      metadata: { count: files.length },
    });

    await workspaceService.recomputeUsage(ctx.workspaceId);
  },

  async search(ctx: AuthContext, params: {
    query: string;
    folderId?: string | null;
    extension?: string;
    mimeType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: any[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 50);
    const where: any = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      name: { contains: params.query },
    };
    if (params.folderId) where.folderId = params.folderId;
    if (params.extension) where.extension = params.extension.toLowerCase();
    if (params.mimeType) where.mimeType = { startsWith: params.mimeType };

    const [items, total] = await Promise.all([
      db.file.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { folder: { select: { id: true, name: true } } },
      }),
      db.file.count({ where }),
    ]);
    return { items, total };
  },
};
