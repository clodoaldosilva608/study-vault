import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { fileService } from '@/lib/services/file';
import { apiHandler, validate } from '@/lib/api/handler';
import { moveFileSchema, renameFileSchema } from '@/lib/schemas';

export const GET = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    return fileService.get(auth, id);
  });

export const PATCH = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.name === 'string') {
      const data = validate(renameFileSchema, body);
      return fileService.rename(auth, id, data.name);
    }
    if ('folderId' in body) {
      const data = validate(moveFileSchema, body);
      return fileService.move(auth, id, data.folderId ?? null);
    }
    throw new Error('Nothing to update');
  });

export const DELETE = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const permanent = url.searchParams.get('permanent') === 'true';
    if (permanent) {
      await fileService.purge(auth, id);
    } else {
      await fileService.softDelete(auth, id);
    }
    return { ok: true };
  });
