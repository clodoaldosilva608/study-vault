import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { recentService } from '@/lib/services/favorite';
import { apiHandler, paginated } from '@/lib/api/handler';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '25');
    const { items, total } = await recentService.list(ctx, { page, pageSize });
    return paginated(items, total, page, pageSize);
  });
