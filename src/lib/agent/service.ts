import { db, ensureSchema } from '@/lib/db';
import { Errors } from '@/lib/domain/errors';
import {
  AGENT_SCOPE,
  AUDIT_ACTION,
  DEFAULT_AGENT_SCOPES,
  RESOURCE_TYPE,
} from '@/lib/domain/constants';
import { audit } from '@/lib/infra/audit/audit';
import { generateApiKey, generateRequestKey, hashApiKey } from '@/lib/infra/auth/api-key';
import type { AuthContext } from '@/lib/infra/auth/session';

export type AgentIdentity = {
  credentialId: string;
  workspaceId: string;
  name: string;
  scopes: string[];
  requestId: string;
};

export const agentService = {
  async issueCredential(ctx: AuthContext, params: {
    name: string;
    scopes?: string[];
  }): Promise<{ credential: any; plainToken: string }> {
    if (!params.name || params.name.trim().length === 0) {
      throw Errors.badRequest('Agent name is required');
    }
    const scopes = params.scopes ?? DEFAULT_AGENT_SCOPES;
    const { plain, hash, prefix } = generateApiKey(ctx.workspaceId);

    const credential = await db.agentCredential.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: params.name,
        tokenHash: hash,
        tokenPrefix: prefix,
        scopes: JSON.stringify(scopes),
        createdBy: ctx.user.id,
      },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.AGENT_CREDENTIAL_ISSUE,
      resourceType: RESOURCE_TYPE.AGENT,
      resourceId: credential.id,
      requestId: ctx.requestId,
      metadata: { name: params.name, scopes },
    });

    return { credential, plainToken: plain };
  },

  async listCredentials(ctx: AuthContext) {
    return db.agentCredential.findMany({
      where: { workspaceId: ctx.workspaceId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revokeCredential(ctx: AuthContext, id: string) {
    const cred = await db.agentCredential.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!cred) throw Errors.notFound('Agent credential');

    await db.agentCredential.update({
      where: { id: cred.id },
      data: { revokedAt: new Date() },
    });

    await audit.record({
      workspaceId: ctx.workspaceId,
      actorType: 'USER',
      actorId: ctx.user.id,
      actorName: ctx.user.email,
      action: AUDIT_ACTION.AGENT_CREDENTIAL_REVOKE,
      resourceType: RESOURCE_TYPE.AGENT,
      resourceId: cred.id,
      requestId: ctx.requestId,
      metadata: { name: cred.name },
    });
  },

  /**
   * Resolve an agent identity from the Authorization header.
   * Format: `Authorization: Bearer sva_<wsId>_<secret>`
   */
  async authenticate(rawHeader: string | null): Promise<AgentIdentity> {
    if (!rawHeader) throw Errors.unauthorized('Missing Authorization header');
    const match = rawHeader.match(/^Bearer\s+(sva_\S+)$/i);
    if (!match) throw Errors.unauthorized('Invalid Authorization header');

    const token = match[1];
    const hash = hashApiKey(token);

    // On Vercel serverless, make sure the schema exists before querying.
    await ensureSchema();

    const credential = await db.agentCredential.findUnique({
      where: { tokenHash: hash },
    });
    if (!credential || credential.revokedAt) {
      throw Errors.unauthorized('Invalid or revoked agent credential');
    }

    await db.agentCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      credentialId: credential.id,
      workspaceId: credential.workspaceId,
      name: credential.name,
      scopes: JSON.parse(credential.scopes) as string[],
      requestId: generateRequestKey(),
    };
  },

  /**
   * Assert that the agent has a required scope. Throws Forbidden if missing.
   */
  assertScope(agent: AgentIdentity, scope: string): void {
    if (!agent.scopes.includes(scope)) {
      throw Errors.forbidden(
        `Agent is missing required scope: ${scope}`,
      );
    }
  },

  /**
   * Record an agent action in the audit log.
   */
  async recordAgentAction(
    agent: AgentIdentity,
    action: string,
    opts: {
      resourceType?: string;
      resourceId?: string;
      outcome?: 'SUCCESS' | 'DENIED' | 'ERROR';
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    await audit.record({
      workspaceId: agent.workspaceId,
      actorType: 'AGENT',
      actorId: agent.credentialId,
      actorName: agent.name,
      action,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
      requestId: agent.requestId,
      outcome: opts.outcome ?? 'SUCCESS',
      metadata: opts.metadata ?? {},
    });
  },
};

export { AGENT_SCOPE };
