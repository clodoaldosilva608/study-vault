import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/infra/auth/session';
import { agentService } from '@/lib/agent/service';
import { apiHandler } from '@/lib/api/handler';
import { ROLE } from '@/lib/domain/constants';

export const DELETE = (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  apiHandler(async () => {
    const auth = await requireAuth();
    requireRole(auth, [ROLE.OWNER, ROLE.ADMIN]);
    const { id } = await ctx.params;
    await agentService.revokeCredential(auth, id);
    return { ok: true };
  });
