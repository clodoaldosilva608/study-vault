import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  requireAuth,
  hashPassword,
  verifyPassword,
  clearSessionCookie,
} from '@/lib/infra/auth/session';
import { audit } from '@/lib/infra/audit/audit';
import { AUDIT_ACTION, AUDIT_OUTCOME } from '@/lib/domain/constants';
import { apiHandler, validate } from '@/lib/api/handler';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const data = validate(changePasswordSchema, body);

    if (data.newPassword === data.currentPassword) {
      throw Errors.badRequest('New password must be different from current');
    }

    const user = await db.user.findUnique({ where: { id: ctx.user.id } });
    if (!user) throw Errors.unauthorized();

    const ok = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!ok) {
      await audit.record({
        workspaceId: ctx.workspaceId,
        actorType: 'USER',
        actorId: user.id,
        actorName: user.email,
        action: AUDIT_ACTION.USER_PASSWORD_CHANGE,
        requestId: ctx.requestId,
        outcome: AUDIT_OUTCOME.DENIED,
        metadata: { reason: 'invalid_current_password' },
      });
      throw Errors.unauthorized('Current password is incorrect');
    }

    const newHash = await hashPassword(data.newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all other sessions for this user (force re-login elsewhere).
    await db.session.deleteMany({
      where: { userId: user.id },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      actorName: user.email,
      action: AUDIT_ACTION.USER_PASSWORD_CHANGE,
      requestId: ctx.requestId,
      metadata: { password_changed: true },
    });

    // Clear current session cookie too — user must re-login with new password.
    await clearSessionCookie();

    return { ok: true, message: 'Password changed. Please sign in again.' };
  });
