import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { noteService } from '@/lib/services/note';
import { apiHandler, validate, paginated } from '@/lib/api/handler';
import { createNoteSchema } from '@/lib/schemas';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId');
    const query = url.searchParams.get('q') || undefined;
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '25');
    const { items, total } = await noteService.list(ctx, {
      folderId: folderId === 'null' ? null : folderId ?? undefined,
      includeDeleted,
      query,
      page,
      pageSize,
    });
    return paginated(items, total, page, pageSize);
  });

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const data = validate(createNoteSchema, body);
    const note = await noteService.create(ctx, {
      title: data.title,
      content: data.content,
      folderId: data.folderId ?? null,
      tags: data.tags,
    });
    return { note };
  }, { status: 201 });
