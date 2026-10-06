import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db, ensureSchema } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import { AUDIT_ACTION, AUDIT_OUTCOME } from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { generateRequestKey } from './api-key';
import { hashPassword, verifyPassword } from './password';

// Re-export password utilities for backward compatibility.
export { hashPassword, verifyPassword };

const JWT_SECRET =
  process.env.JWT_SECRET ||
  // Stable default for demo deploys. OVERRIDE in production via env var.
  'study-vault-demo-jwt-secret-please-override-in-production-0123456789';
const SESSION_COOKIE = 'sv_session';
const SESSION_TTL_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthContext = {
  user: AuthUser;
  workspaceId: string;
  role: string;
  requestId: string;
};

// ---- JWT session ----

type SessionPayload = {
  sub: string;
  email: string;
};

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_TTL_DAYS}d` });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

// ---- Cookie helpers ----

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

// ---- Auth context resolution ----

/**
 * Lazy import of ensureSeedUser to avoid circular dependency
 * (seed.ts imports hashPassword from password.ts, not from session.ts).
 */
async function ensureSeedUserSafe(): Promise<void> {
  try {
    const { ensureSeedUser } = await import('./seed');
    await ensureSeedUser();
  } catch {
    /* ignore — best effort */
  }
}

/**
 * Resolve the auth context for the current request.
 *
 * On Vercel serverless, each function has its own ephemeral /tmp DB.
 * The seed user uses DETERMINISTIC IDs, so ensureSeedUser() recreates
 * the exact same user+workspace on every instance. This means a JWT
 * issued by instance A is valid when verified by instance B.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  // On Vercel serverless, make sure the schema + seed user exist.
  // This is idempotent and cached after the first call within a warm instance.
  await ensureSchema();
  await ensureSeedUserSafe();

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;

  // Resolve the user's primary workspace membership.
  // MVP: each user has exactly one personal workspace.
  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) return null;

  return {
    user,
    workspaceId: membership.workspaceId,
    role: membership.role,
    requestId: generateRequestKey(),
  };
}

/**
 * Require an authenticated user. Throws DomainError if missing.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw Errors.unauthorized('Authentication required');
  return ctx;
}

/**
 * Require that the user has at least one of the given roles.
 */
export function requireRole(
  ctx: AuthContext,
  roles: string[],
): void {
  if (!roles.includes(ctx.role)) {
    throw Errors.forbidden('Insufficient role');
  }
}

// ---- Audit-friendly wrappers ----

export async function recordAuthEvent(
  ctx: AuthContext | { user: AuthUser; workspaceId: string },
  action: string,
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR' = 'SUCCESS',
  details?: Record<string, unknown>,
): Promise<void> {
  await audit.record({
    workspaceId: ctx.workspaceId,
    actorType: 'USER',
    actorId: ctx.user.id,
    actorName: ctx.user.email,
    action,
    requestId: generateRequestKey(),
    outcome,
    metadata: details || {},
  });
}

export { AUDIT_ACTION, AUDIT_OUTCOME };
