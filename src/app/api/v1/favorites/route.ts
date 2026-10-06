import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { favoriteService } from '@/lib/services/favorite';
import { apiHandler } from '@/lib/api/handler';

export const GET = () =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const items = await favoriteService.list(ctx);
    return { items };
  });

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const fileId = body.fileId as string;
    if (!fileId) throw new Error('fileId required');
    return favoriteService.add(ctx, fileId);
  });

export const DELETE = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    if (!fileId) throw new Error('fileId required');
    await favoriteService.remove(ctx, fileId);
    return { ok: true };
  });
