import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { folderService } from '@/lib/services/folder';
import { apiHandler } from '@/lib/api/handler';

export const POST = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    await folderService.restore(auth, id);
    return { ok: true };
  });
