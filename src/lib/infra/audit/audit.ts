import { db } from '@/lib/db';
import { AUDIT_OUTCOME } from '@/lib/domain/constants';

type AuditInput = {
  workspaceId: string;
  actorType: 'USER' | 'AGENT' | 'SYSTEM';
  actorId: string;
  actorName: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  requestId: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'ERROR';
  metadata?: Record<string, unknown>;
};

/**
 * Audit service — writes structured records to `audit_logs`.
 *
 * Notes:
 * - Never logs secrets, tokens, or file contents.
 * - Metadata is JSON-stringified (SQLite has no JSONB).
 * - Failures here should never break the caller; we log to stderr and continue.
 */
export const audit = {
  async record(input: AuditInput): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorType: input.actorType,
          actorId: input.actorId,
          actorName: input.actorName,
          action: input.action,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          requestId: input.requestId,
          metadata: JSON.stringify(input.metadata ?? {}),
          outcome: input.outcome ?? AUDIT_OUTCOME.SUCCESS,
        },
      });
    } catch (err) {
      console.error('[audit] failed to record', {
        action: input.action,
        requestId: input.requestId,
        err,
      });
    }
  },

  async list(workspaceId: string, opts: {
    page?: number;
    pageSize?: number;
    action?: string;
    actorType?: string;
  } = {}): Promise<{ items: any[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 25);
    const where: any = { workspaceId };
    if (opts.action) where.action = opts.action;
    if (opts.actorType) where.actorType = opts.actorType;

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};
