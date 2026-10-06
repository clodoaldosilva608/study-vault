import { NextRequest } from 'next/server';
import { clearSessionCookie, getAuthContext } from '@/lib/infra/auth/session';
import { audit } from '@/lib/infra/audit/audit';
import { AUDIT_ACTION } from '@/lib/domain/constants';
import { apiHandler } from '@/lib/api/handler';

export const POST = (_req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await getAuthContext();
    if (ctx) {
      await audit.record({
        workspaceId: ctx.workspaceId,
        actorType: 'USER',
        actorId: ctx.user.id,
        actorName: ctx.user.email,
        action: AUDIT_ACTION.USER_LOGOUT,
        requestId: ctx.requestId,
      });
    }
    await clearSessionCookie();
    return { ok: true };
  });
