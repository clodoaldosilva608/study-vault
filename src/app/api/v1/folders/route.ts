import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { folderService } from '@/lib/services/folder';
import { apiHandler, validate, paginated } from '@/lib/api/handler';
import { createFolderSchema } from '@/lib/schemas';

export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const parentId = url.searchParams.get('parentId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '100');
    const { items, total } = await folderService.list(ctx, {
      parentId: parentId === 'null' ? null : parentId ?? undefined,
      includeDeleted,
      page,
      pageSize,
    });
    return paginated(items, total, page, pageSize);
  });

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const data = validate(createFolderSchema, body);
    const folder = await folderService.create(ctx, {
      name: data.name,
      parentId: data.parentId ?? null,
    });
    return folder;
  }, { status: 201 });
