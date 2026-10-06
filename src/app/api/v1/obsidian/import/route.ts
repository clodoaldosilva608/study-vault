import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { folderService } from '@/lib/services/folder';
import { noteService } from '@/lib/services/note';
import { db } from '@/lib/db';
import { apiHandler, validate } from '@/lib/api/handler';
import { obsidianImportSchema } from '@/lib/schemas';

/**
 * POST /api/v1/obsidian/import
 * Body: { files: [{ name, content, folderPath? }] }
 *
 * Imports Markdown files into the workspace as Notes, recreating folder structure
 * under /Obsidian Import/<folderPath>. Skips duplicates (same title under same folder).
 */
export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const data = validate(obsidianImportSchema, body);

    // Ensure root "Obsidian Import" folder exists
    const rootFolder = await findOrCreateFolder(ctx, 'Obsidian Import', null);

    let imported = 0;
    let skipped = 0;
    const errors: { name: string; error: string }[] = [];

    for (const file of data.files) {
      try {
        // Resolve folder chain
        let parentFolderId: string | null = rootFolder.id;
        if (file.folderPath) {
          const parts = file.folderPath.split('/').filter(Boolean);
          for (const part of parts) {
            const f = await findOrCreateFolder(ctx, part, parentFolderId);
            parentFolderId = f.id;
          }
        }

        // Strip .md extension for the title
        const title = file.name.replace(/\.md$/i, '');

        // Skip duplicates
        const existing = await db.note.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            folderId: parentFolderId,
            title,
            deletedAt: null,
          },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        await noteService.create(ctx, {
          title,
          content: file.content,
          folderId: parentFolderId,
        });
        imported += 1;
      } catch (err) {
        errors.push({
          name: file.name,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return { imported, skipped, errors };
  });

async function findOrCreateFolder(
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  name: string,
  parentId: string | null,
) {
  const existing = await db.folder.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      parentId,
      name,
      deletedAt: null,
    },
  });
  if (existing) return existing;
  return folderService.create(ctx, { name, parentId });
}
