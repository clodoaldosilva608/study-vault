import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { db } from '@/lib/db';
import { apiHandler } from '@/lib/api/handler';

/**
 * GET /api/v1/obsidian/export?folderId=...
 * Returns Markdown files representing the workspace's notes, structured by folder.
 *
 * Output shape:
 *   { vault: [{ name, content, folderPath }] }
 *
 * The client (or JARVIS) can then materialize the files on the target Obsidian Vault.
 */
export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId');

    const notes = await db.note.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        ...(folderId && folderId !== 'null' ? { folderId } : {}),
      },
      include: { folder: true },
    });

    const vault = notes.map((note) => {
      const folderPath = note.folder?.path?.replace(/^\//, '').replace(/\/$/, '') || '';
      return {
        name: `${note.title}.md`,
        content: note.content,
        folderPath,
      };
    });

    return { vault, count: vault.length };
  });
