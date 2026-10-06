import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { fileService } from '@/lib/services/file';

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const { buffer, file } = await fileService.getDownloadBuffer(auth, id);
    const contentType = file.mimeType || 'application/octet-stream';
    const filename = encodeURIComponent(file.name);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(buffer.length),
        'cache-control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'error';
    return new NextResponse(
      JSON.stringify({ ok: false, error: { code, message: code } }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }
};
