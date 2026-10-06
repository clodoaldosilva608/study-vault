import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { audit } from '@/lib/infra/audit/audit';
import { apiHandler, paginated } from '@/lib/api/handler';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '50');
    const action = url.searchParams.get('action') || undefined;
    const actorType = url.searchParams.get('actorType') || undefined;
    const { items, total } = await audit.list(ctx.workspaceId, { page, pageSize, action, actorType });
    return paginated(items, total, page, pageSize);
  });
