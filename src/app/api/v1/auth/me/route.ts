import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/infra/auth/session';
import { apiHandler } from '@/lib/api/handler';

export const GET = () =>
  apiHandler(async () => {
    const ctx = await getAuthContext();
    if (!ctx) {
      return { user: null, workspace: null };
    }
    const workspace = await db.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { id: true, name: true, slug: true, plan: true, storageLimitBytes: true },
    });
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.user.id } },
    });
    return {
      user: ctx.user,
      workspace,
      role: membership?.role ?? null,
    };
  });
