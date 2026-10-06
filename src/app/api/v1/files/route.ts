import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { fileService } from '@/lib/services/file';
import { apiHandler, paginated } from '@/lib/api/handler';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const favoriteOnly = url.searchParams.get('favorite') === 'true';
    const extension = url.searchParams.get('extension') || undefined;
    const mimeType = url.searchParams.get('mimeType') || undefined;
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '50');
    const { items, total } = await fileService.list(ctx, {
      folderId: folderId === 'null' ? null : folderId ?? undefined,
      includeDeleted,
      favoriteOnly,
      extension,
      mimeType,
      page,
      pageSize,
    });
    return paginated(items, total, page, pageSize);
  });
