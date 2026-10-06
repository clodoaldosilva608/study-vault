import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { fileService } from '@/lib/services/file';
import { apiHandler, validate, paginated } from '@/lib/api/handler';
import { searchSchema } from '@/lib/schemas';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const data = validate(searchSchema, {
      query: url.searchParams.get('query') || '',
      folderId: url.searchParams.get('folderId'),
      extension: url.searchParams.get('extension') || undefined,
      mimeType: url.searchParams.get('mimeType') || undefined,
      page: url.searchParams.get('page') || undefined,
      pageSize: url.searchParams.get('pageSize') || undefined,
    });
    const { items, total } = await fileService.search(ctx, {
      query: data.query,
      folderId: data.folderId ?? null,
      extension: data.extension,
      mimeType: data.mimeType,
      page: data.page,
      pageSize: data.pageSize,
    });
    return paginated(items, total, data.page ?? 1, data.pageSize ?? 25);
  });
