import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/infra/auth/session';
import { workspaceService } from '@/lib/services/workspace';
import { apiHandler } from '@/lib/api/handler';

export const GET = (_req: NextRequest) =>
  apiHandler(async () => {
    const ctx = await requireAuth();
    const usage = await workspaceService.getUsage(ctx);
    return usage;
  });
