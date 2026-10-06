import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { fileService } from '@/lib/services/file';
import { folderService } from '@/lib/services/folder';
import { apiHandler, paginated } from '@/lib/api/handler';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '50');
    const { items: files, total } = await fileService.list(ctx, {
      includeDeleted: true,
      page,
      pageSize,
    });
    const deletedFiles = files.filter((f: any) => f.deletedAt);
    return paginated(deletedFiles, deletedFiles.length, page, pageSize);
  });

export const DELETE = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    if (url.searchParams.get('empty') === 'true') {
      await fileService.emptyTrash(ctx);
      return { ok: true };
    }
    return { ok: false, message: 'Use ?empty=true to empty trash' };
  });
