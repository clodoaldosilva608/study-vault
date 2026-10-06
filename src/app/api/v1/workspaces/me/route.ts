import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { workspaceService } from '@/lib/services/workspace';
import { apiHandler } from '@/lib/api/handler';

export const GET = () =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const workspace = await workspaceService.getMembership(ctx.user.id, ctx.workspaceId);
    return { workspace: workspace.workspace, role: workspace.role };
  });
