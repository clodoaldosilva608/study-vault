import { NextRequest } from 'next/server';
import { agentService } from '@/lib/agent/service';
import { listToolManifest } from '@/lib/agent/registry';
import { apiHandler } from '@/lib/api/handler';

/**
 * GET /api/v1/agent/tools
 * Returns the manifest of available JARVIS tools (description, required scopes, input schema).
 * Authenticated via Agent API Key.
 */
export const GET = (req: NextRequest) =>
  apiHandler(async () => {
    const agent = await agentService.authenticate(req.headers.get('authorization'));
    return {
      agent: {
        name: agent.name,
        scopes: agent.scopes,
        workspaceId: agent.workspaceId,
      },
      tools: listToolManifest(),
    };
  });
