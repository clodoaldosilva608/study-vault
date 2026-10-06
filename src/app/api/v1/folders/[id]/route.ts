import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { folderService } from '@/lib/services/folder';
import { apiHandler, validate } from '@/lib/api/handler';
import { moveFolderSchema, renameFolderSchema } from '@/lib/schemas';

export const GET = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    return folderService.get(auth, id);
  });

export const PATCH = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.name === 'string') {
      const data = validate(renameFolderSchema, body);
      return folderService.rename(auth, id, data.name);
    }
    if ('parentId' in body) {
      const data = validate(moveFolderSchema, body);
      await folderService.move(auth, id, data.parentId ?? null);
      return { ok: true };
    }
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update' } },
      { status: 400 },
    );
  });

export const DELETE = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    await folderService.softDelete(auth, id);
    return { ok: true };
  });
