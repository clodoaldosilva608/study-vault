import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import { hashPassword } from '@/lib/infra/auth/session';
import { setSessionCookie, signSessionToken, recordAuthEvent } from '@/lib/infra/auth/session';
import { workspaceService } from '@/lib/services/workspace';
import { audit } from '@/lib/infra/audit/audit';
import { AUDIT_ACTION, AUDIT_OUTCOME } from '@/lib/domain/constants';
import { generateRequestKey } from '@/lib/infra/auth/api-key';
import { apiHandler, validate } from '@/lib/api/handler';
import { registerSchema } from '@/lib/schemas';

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const body = await req.json().catch(() => ({}));
    const data = validate(registerSchema, body);

    const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) {
      throw Errors.conflict('Email already registered');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await db.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name || null,
        passwordHash,
      },
    });

    // Bootstrap personal workspace + Owner membership + usage counter
    const { workspaceId } = await workspaceService.createPersonalWorkspace({
      ownerId: user.id,
      ownerEmail: user.email,
      name: data.name ? `Personal — ${data.name}` : undefined,
    });

    const requestId = generateRequestKey();
    await audit.record({
      workspaceId,
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      action: AUDIT_ACTION.USER_REGISTER,
      requestId,
      metadata: { email: user.email },
    });

    const token = signSessionToken({ sub: user.id, email: user.email });
    await setSessionCookie(token);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      workspaceId,
    };
  });
