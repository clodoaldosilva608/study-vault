import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { noteService } from '@/lib/services/note';
import { apiHandler, validate } from '@/lib/api/handler';
import { updateNoteSchema } from '@/lib/schemas';

export const GET = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    return noteService.get(auth, id);
  });

export const PATCH = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = validate(updateNoteSchema, body);
    return noteService.update(auth, id, data);
  });

export const DELETE = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    await noteService.softDelete(auth, id);
    return { ok: true };
  });
