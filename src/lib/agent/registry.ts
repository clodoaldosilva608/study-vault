import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  AGENT_SCOPE,
  AUDIT_ACTION,
  RESOURCE_TYPE,
} from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { storage } from '@/lib/infra/storage/adapter';
import type { AgentIdentity } from './service';

/**
 * JARVIS Tool Registry — each tool has a stable name, schema, and required scopes.
 * Tools are pure functions: (agent, args) → result. Audit is recorded per call.
 *
 * Read-only tools are enabled by default. Write tools require explicit scope grant.
 */

type ToolContext = {
  agent: AgentIdentity;
};

export interface ToolResult<T = unknown> {
  requestId: string;
  data: T;
}

export interface ToolDefinition<I = Record<string, unknown>, O = unknown> {
  name: string;
  description: string;
  requiredScopes: string[];
  inputSchema: Record<string, { type: string; required?: boolean; description: string }>;
  handler: (ctx: ToolContext, args: I) => Promise<ToolResult<O>>;
}

// ============================================================
// TOOLS — Read-only
// ============================================================

export const searchFilesTool: ToolDefinition<
  { query?: string; folderId?: string; extension?: string; limit?: number },
  { items: any[]; total: number }
> = {
  name: 'search_files',
  description:
    'Search files in the agent workspace by name, extension, or folder. Respects workspace isolation.',
  requiredScopes: [AGENT_SCOPE.FILES_READ],
  inputSchema: {
    query: { type: 'string', required: false, description: 'Substring match on file name' },
    folderId: { type: 'string', required: false, description: 'Restrict to this folder' },
    extension: { type: 'string', required: false, description: 'Filter by extension (e.g. pdf)' },
    limit: { type: 'number', required: false, description: 'Max results (default 25, max 100)' },
  },
  async handler(ctx, args) {
    const limit = Math.min(100, args.limit ?? 25);
    const where: any = {
      workspaceId: ctx.agent.workspaceId,
      deletedAt: null,
    };
    if (args.query) where.name = { contains: args.query };
    if (args.folderId) where.folderId = args.folderId;
    if (args.extension) where.extension = args.extension.toLowerCase();

    const [items, total] = await Promise.all([
      db.file.findMany({
        where,
        select: {
          id: true,
          name: true,
          extension: true,
          mimeType: true,
          sizeBytes: true,
          updatedAt: true,
          folder: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
      db.file.count({ where }),
    ]);

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_SEARCH_FILES,
      resourceType: RESOURCE_TYPE.FILE,
      requestId: ctx.agent.requestId,
      metadata: { query: args.query, folderId: args.folderId, results: items.length },
    });

    return { requestId: ctx.agent.requestId, data: { items, total } };
  },
};

export const getFileTool: ToolDefinition<
  { fileId: string },
  { id: string; name: string; extension: string; mimeType: string; sizeBytes: number; updatedAt: string; content?: string }
> = {
  name: 'get_file',
  description: 'Get metadata and (for text/markdown) content of a single file.',
  requiredScopes: [AGENT_SCOPE.FILES_READ],
  inputSchema: {
    fileId: { type: 'string', required: true, description: 'File ID' },
  },
  async handler(ctx, args) {
    const file = await db.file.findFirst({
      where: { id: args.fileId, workspaceId: ctx.agent.workspaceId, deletedAt: null },
    });
    if (!file) throw Errors.notFound('File');

    const result: any = {
      id: file.id,
      name: file.name,
      extension: file.extension,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      updatedAt: file.updatedAt.toISOString(),
    };

    // For text-like files, include content (capped at 64KB)
    if (
      file.mimeType.startsWith('text/') ||
      file.extension === 'md' ||
      file.extension === 'markdown' ||
      file.extension === 'txt'
    ) {
      const buf = await storage.read(file.storagePath);
      result.content = buf.toString('utf8', 0, Math.min(buf.length, 64 * 1024));
    }

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_GET_FILE,
      resourceType: RESOURCE_TYPE.FILE,
      resourceId: file.id,
      requestId: ctx.agent.requestId,
      metadata: { name: file.name, returnedContent: !!result.content },
    });

    return { requestId: ctx.agent.requestId, data: result };
  },
};

export const listFolderTool: ToolDefinition<
  { folderId?: string | null; limit?: number },
  { folders: any[]; files: any[] }
> = {
  name: 'list_folder',
  description: 'List immediate children (folders + files) of a folder. Omit folderId for root.',
  requiredScopes: [AGENT_SCOPE.FOLDERS_READ, AGENT_SCOPE.FILES_READ],
  inputSchema: {
    folderId: { type: 'string', required: false, description: 'Folder ID; omit for workspace root' },
    limit: { type: 'number', required: false, description: 'Max children (default 50, max 200)' },
  },
  async handler(ctx, args) {
    const limit = Math.min(200, args.limit ?? 50);
    const folderId = args.folderId ?? null;

    const [folders, files] = await Promise.all([
      db.folder.findMany({
        where: { workspaceId: ctx.agent.workspaceId, parentId: folderId, deletedAt: null },
        select: {
          id: true, name: true, path: true,
          _count: { select: { files: { where: { deletedAt: null } }, children: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
      db.file.findMany({
        where: { workspaceId: ctx.agent.workspaceId, folderId, deletedAt: null },
        select: {
          id: true, name: true, extension: true,
          mimeType: true, sizeBytes: true, updatedAt: true,
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
    ]);

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_LIST_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folderId ?? 'root',
      requestId: ctx.agent.requestId,
      metadata: { folders: folders.length, files: files.length },
    });

    return { requestId: ctx.agent.requestId, data: { folders, files } };
  },
};

export const searchNotesTool: ToolDefinition<
  { query?: string; limit?: number },
  { items: any[]; total: number }
> = {
  name: 'search_notes',
  description: 'Search notes by title (or list all if no query).',
  requiredScopes: [AGENT_SCOPE.NOTES_READ],
  inputSchema: {
    query: { type: 'string', required: false, description: 'Substring match on note title' },
    limit: { type: 'number', required: false, description: 'Max results (default 25, max 100)' },
  },
  async handler(ctx, args) {
    const limit = Math.min(100, args.limit ?? 25);
    const where: any = {
      workspaceId: ctx.agent.workspaceId,
      deletedAt: null,
    };
    if (args.query) where.title = { contains: args.query };

    const [items, total] = await Promise.all([
      db.note.findMany({
        where,
        select: { id: true, title: true, updatedAt: true, tags: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      db.note.count({ where }),
    ]);

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_SEARCH_NOTES,
      resourceType: RESOURCE_TYPE.NOTE,
      requestId: ctx.agent.requestId,
      metadata: { query: args.query, results: items.length },
    });

    return { requestId: ctx.agent.requestId, data: { items, total } };
  },
};

export const getNoteTool: ToolDefinition<
  { noteId: string },
  { id: string; title: string; content: string; tags: string[]; updatedAt: string; folder?: any }
> = {
  name: 'get_note',
  description: 'Get full content of a single note.',
  requiredScopes: [AGENT_SCOPE.NOTES_READ],
  inputSchema: {
    noteId: { type: 'string', required: true, description: 'Note ID' },
  },
  async handler(ctx, args) {
    const note = await db.note.findFirst({
      where: { id: args.noteId, workspaceId: ctx.agent.workspaceId, deletedAt: null },
      include: { folder: { select: { id: true, name: true } } },
    });
    if (!note) throw Errors.notFound('Note');

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_GET_NOTE,
      resourceType: RESOURCE_TYPE.NOTE,
      resourceId: note.id,
      requestId: ctx.agent.requestId,
    });

    return {
      requestId: ctx.agent.requestId,
      data: {
        id: note.id,
        title: note.title,
        content: note.content,
        tags: JSON.parse(note.tags || '[]'),
        updatedAt: note.updatedAt.toISOString(),
        folder: note.folder,
      },
    };
  },
};

export const getRecentFilesTool: ToolDefinition<
  { limit?: number },
  { items: any[] }
> = {
  name: 'get_recent_files',
  description: 'Return recently accessed files for the workspace (aggregated across users).',
  requiredScopes: [AGENT_SCOPE.RECENT_READ],
  inputSchema: {
    limit: { type: 'number', required: false, description: 'Max results (default 10, max 50)' },
  },
  async handler(ctx, args) {
    const limit = Math.min(50, args.limit ?? 10);
    const items = await db.recentFile.findMany({
      where: { workspaceId: ctx.agent.workspaceId },
      orderBy: { accessedAt: 'desc' },
      take: limit,
      include: {
        file: {
          select: { id: true, name: true, extension: true, mimeType: true, sizeBytes: true },
        },
      },
    });
    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_GET_RECENT,
      requestId: ctx.agent.requestId,
      metadata: { count: items.length },
    });
    return {
      requestId: ctx.agent.requestId,
      data: {
        items: items.map((r) => ({
          fileId: r.file.id,
          name: r.file.name,
          extension: r.file.extension,
          mimeType: r.file.mimeType,
          sizeBytes: r.file.sizeBytes,
          accessedAt: r.accessedAt.toISOString(),
        })),
      },
    };
  },
};

export const getFavoritesTool: ToolDefinition<
  { limit?: number },
  { items: any[] }
> = {
  name: 'get_favorites',
  description: 'Return favorite files in the workspace (aggregated across users).',
  requiredScopes: [AGENT_SCOPE.FAVORITES_READ],
  inputSchema: {
    limit: { type: 'number', required: false, description: 'Max results (default 25, max 100)' },
  },
  async handler(ctx, args) {
    const limit = Math.min(100, args.limit ?? 25);
    const items = await db.favorite.findMany({
      where: { workspaceId: ctx.agent.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        file: {
          select: {
            id: true, name: true, extension: true,
            mimeType: true, sizeBytes: true,
          },
        },
      },
    });
    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_GET_FAVORITES,
      requestId: ctx.agent.requestId,
      metadata: { count: items.length },
    });
    return {
      requestId: ctx.agent.requestId,
      data: {
        items: items.map((f) => ({
          fileId: f.file.id,
          name: f.file.name,
          extension: f.file.extension,
          mimeType: f.file.mimeType,
          sizeBytes: f.file.sizeBytes,
        })),
      },
    };
  },
};

// ============================================================
// TOOLS — Write (require explicit scope)
// ============================================================

export const createNoteTool: ToolDefinition<
  { title: string; content: string; folderId?: string | null; idempotencyKey?: string },
  { note: any }
> = {
  name: 'create_note',
  description: 'Create a Markdown note. Idempotent on title+content+folder+idempotencyKey.',
  requiredScopes: [AGENT_SCOPE.NOTES_WRITE],
  inputSchema: {
    title: { type: 'string', required: true, description: 'Note title' },
    content: { type: 'string', required: false, description: 'Markdown content' },
    folderId: { type: 'string', required: false, description: 'Parent folder ID' },
    idempotencyKey: { type: 'string', required: false, description: 'Idempotency key to dedupe retries' },
  },
  async handler(ctx, args) {
    if (args.folderId) {
      const folder = await db.folder.findFirst({
        where: { id: args.folderId, workspaceId: ctx.agent.workspaceId, deletedAt: null },
      });
      if (!folder) throw Errors.notFound('Folder');
    }

    // Idempotency: search for existing note with same title within last 5 minutes
    if (args.idempotencyKey) {
      const recent = await db.auditLog.findFirst({
        where: {
          workspaceId: ctx.agent.workspaceId,
          actorType: 'AGENT',
          actorId: ctx.agent.credentialId,
          action: AUDIT_ACTION.JARVIS_CREATE_NOTE,
          requestId: ctx.agent.requestId,
        },
      });
      if (recent) {
        const meta = JSON.parse(recent.metadata || '{}');
        if (meta.noteId) {
          const existing = await db.note.findUnique({ where: { id: meta.noteId } });
          if (existing) return { requestId: ctx.agent.requestId, data: { note: existing } };
        }
      }
    }

    const note = await db.note.create({
      data: {
        workspaceId: ctx.agent.workspaceId,
        folderId: args.folderId ?? null,
        title: args.title,
        content: args.content || '',
        format: 'markdown',
        tags: '[]',
        createdBy: ctx.agent.credentialId,
        updatedBy: ctx.agent.credentialId,
      },
    });

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_CREATE_NOTE,
      resourceType: RESOURCE_TYPE.NOTE,
      resourceId: note.id,
      requestId: ctx.agent.requestId,
      metadata: { title: note.title, idempotencyKey: args.idempotencyKey },
    });

    return { requestId: ctx.agent.requestId, data: { note } };
  },
};

export const createFolderTool: ToolDefinition<
  { name: string; parentId?: string | null; idempotencyKey?: string },
  { folder: any }
> = {
  name: 'create_folder',
  description: 'Create a folder. Idempotent on name+parentId+idempotencyKey.',
  requiredScopes: [AGENT_SCOPE.FOLDERS_CREATE],
  inputSchema: {
    name: { type: 'string', required: true, description: 'Folder name' },
    parentId: { type: 'string', required: false, description: 'Parent folder ID; null for root' },
    idempotencyKey: { type: 'string', required: false, description: 'Idempotency key' },
  },
  async handler(ctx, args) {
    const parentId = args.parentId ?? null;
    let parentPath = '/';
    if (parentId) {
      const parent = await db.folder.findFirst({
        where: { id: parentId, workspaceId: ctx.agent.workspaceId, deletedAt: null },
      });
      if (!parent) throw Errors.notFound('Parent folder');
      parentPath = parent.path.endsWith('/')
        ? `${parent.path}${parent.name}/`
        : `${parent.path}/${parent.name}/`;
    }

    // Idempotency check
    const existing = await db.folder.findFirst({
      where: {
        workspaceId: ctx.agent.workspaceId,
        parentId,
        name: args.name,
        deletedAt: null,
      },
    });
    if (existing) {
      return { requestId: ctx.agent.requestId, data: { folder: existing } };
    }

    const folder = await db.folder.create({
      data: {
        workspaceId: ctx.agent.workspaceId,
        parentId,
        name: args.name,
        path: parentPath + args.name,
        createdBy: ctx.agent.credentialId,
      },
    });

    await audit.record({
      workspaceId: ctx.agent.workspaceId,
      actorType: 'AGENT',
      actorId: ctx.agent.credentialId,
      actorName: ctx.agent.name,
      action: AUDIT_ACTION.JARVIS_CREATE_FOLDER,
      resourceType: RESOURCE_TYPE.FOLDER,
      resourceId: folder.id,
      requestId: ctx.agent.requestId,
      metadata: { name: folder.name, parentId, idempotencyKey: args.idempotencyKey },
    });

    return { requestId: ctx.agent.requestId, data: { folder } };
  },
};

// ============================================================
// REGISTRY
// ============================================================

export const TOOL_REGISTRY: Record<string, ToolDefinition<any, any>> = {
  search_files: searchFilesTool,
  get_file: getFileTool,
  list_folder: listFolderTool,
  search_notes: searchNotesTool,
  get_note: getNoteTool,
  get_recent_files: getRecentFilesTool,
  get_favorites: getFavoritesTool,
  create_note: createNoteTool,
  create_folder: createFolderTool,
};

export function listToolManifest() {
  return Object.values(TOOL_REGISTRY).map((t) => ({
    name: t.name,
    description: t.description,
    requiredScopes: t.requiredScopes,
    inputSchema: t.inputSchema,
  }));
}
