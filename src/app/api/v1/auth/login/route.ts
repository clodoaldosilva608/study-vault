import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  verifyPassword,
  signSessionToken,
  setSessionCookie,
} from '@/lib/infra/auth/session';
import { generateRequestKey } from '@/lib/infra/auth/api-key';
import { audit } from '@/lib/infra/audit/audit';
import { AUDIT_ACTION, AUDIT_OUTCOME } from '@/lib/domain/constants';
import { apiHandler, validate } from '@/lib/api/handler';
import { loginSchema } from '@/lib/schemas';
import { ensureSeedUser } from '@/lib/infra/auth/seed';

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    // Ensure the bootstrap demo user exists (idempotent — needed on Vercel cold starts).
    await ensureSeedUser();

    const body = await req.json().catch(() => ({}));
    const data = validate(loginSchema, body);

    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (!user) {
      throw Errors.unauthorized('Invalid credentials');
    }

    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) {
      const requestId = generateRequestKey();
      await audit.record({
        workspaceId: 'unknown',
        actorType: 'USER',
        actorId: user.id,
        actorName: user.email,
        action: AUDIT_ACTION.USER_LOGIN,
        requestId,
        outcome: AUDIT_OUTCOME.DENIED,
        metadata: { reason: 'invalid_password' },
      }).catch(() => null);
      throw Errors.unauthorized('Invalid credentials');
    }

    const membership = await db.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) {
      throw Errors.internal('User has no workspace');
    }

    const workspace = await db.workspace.findUnique({
      where: { id: membership.workspaceId },
      select: { id: true, name: true, slug: true, plan: true, storageLimitBytes: true },
    });

    const requestId = generateRequestKey();
    await audit.record({
      workspaceId: membership.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      action: AUDIT_ACTION.USER_LOGIN,
      requestId,
      metadata: {},
    });

    const token = signSessionToken({ sub: user.id, email: user.email });
    await setSessionCookie(token);

    // Return FULL user + workspace + role so the frontend can set the store
    // directly without needing a second /auth/me call (which might hit a
    // different serverless instance with an empty DB).
    return {
      user: { id: user.id, email: user.email, name: user.name },
      workspace,
      role: membership.role,
    };
  });
