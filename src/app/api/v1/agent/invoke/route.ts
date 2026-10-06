import { NextRequest } from 'next/server';
import { agentService } from '@/lib/agent/service';
import { TOOL_REGISTRY } from '@/lib/agent/registry';
import { Errors } from '@/lib/domain/errors';
import { apiHandler, validate } from '@/lib/api/handler';
import { agentInvokeToolSchema } from '@/lib/schemas';

/**
 * POST /api/v1/agent/invoke
 * Body: { tool: 'search_files', args: {...}, idempotencyKey?: '...' }
 *
 * Flow:
 *   1. authenticate agent
 *   2. resolve tool from registry
 *   3. verify agent has all required scopes
 *   4. invoke handler with workspaceId from credential (never trust client)
 *   5. audit logged by tool itself
 *   6. return envelope
 */
export const POST = (req: NextRequest) =>
  apiHandler(async () => {
    const agent = await agentService.authenticate(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));
    const data = validate(agentInvokeToolSchema, body);

    const tool = TOOL_REGISTRY[data.tool];
    if (!tool) {
      throw Errors.notFound(`Tool '${data.tool}'`);
    }

    // Verify scopes — at least one required scope must be present
    const hasScope = tool.requiredScopes.some((s) => agent.scopes.includes(s));
    if (!hasScope) {
      await agentService.recordAgentAction(agent, `JARVIS_${data.tool.toUpperCase()}`, {
        outcome: 'DENIED',
        metadata: { requiredScopes: tool.requiredScopes, agentScopes: agent.scopes },
      });
      throw Errors.forbidden(
        `Agent is missing one of required scopes: ${tool.requiredScopes.join(', ')}`,
      );
    }

    const result = await tool.handler({ agent }, data.args);
    return result;
  });
