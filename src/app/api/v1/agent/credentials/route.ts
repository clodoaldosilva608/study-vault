import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/infra/auth/session';
import { agentService } from '@/lib/agent/service';
import { apiHandler, validate } from '@/lib/api/handler';
import { agentIssueCredentialSchema } from '@/lib/schemas';
import { ROLE } from '@/lib/domain/constants';

export const GET = () =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const items = await agentService.listCredentials(ctx);
    return { items };
  });

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    requireRole(ctx, [ROLE.OWNER, ROLE.ADMIN]);
    const body = await req.json().catch(() => ({}));
    const data = validate(agentIssueCredentialSchema, body);
    const { credential, plainToken } = await agentService.issueCredential(ctx, {
      name: data.name,
      scopes: data.scopes,
    });
    // The plain token is shown ONCE here.
    return { credential, plainToken };
  }, { status: 201 });
