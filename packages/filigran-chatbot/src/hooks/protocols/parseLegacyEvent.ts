import type { ParsedAction, ProtocolContext } from './types';

/**
 * Parse a Flowise-style SSE event into a normalized action.
 */
export function parseLegacyEvent(evt: Record<string, unknown>, ctx: ProtocolContext): ParsedAction {
  const eventType = evt.event as string | undefined;

  if (eventType === 'nextAgentFlow') {
    const data = evt.data as Record<string, unknown> | undefined;
    const nodeId = data?.nodeId as string | undefined;
    if (data?.status === 'INPROGRESS' && nodeId) {
      ctx.activeNodeId = nodeId;
    }
    return { action: 'noop' };
  }

  if (eventType === 'start') {
    return { action: 'noop' };
  }

  if (eventType === 'token') {
    const tokenData = ((evt.data as string) ?? '').replace(/<br\s*\/?>/g, '\n');
    return { action: 'stream', content: tokenData };
  }

  if (eventType === 'agentReasoning') {
    const reasoning = evt.data as Record<string, unknown> | undefined;
    const usedTools = reasoning?.usedTools as Array<{ tool: string }> | undefined;
    if (usedTools?.length) {
      ctx.hasUsedTools = true;
      return { action: 'status', status: 'tool_start', tools: usedTools.map((t) => t.tool) };
    }
    if (ctx.hasUsedTools) {
      return { action: 'status', status: 'analyzing' };
    }
    return { action: 'status', status: 'thinking' };
  }

  if (eventType === 'usedTools') {
    ctx.hasUsedTools = true;
    const data = evt.data as Array<{ tool: string }> | undefined;
    const toolNames = Array.isArray(data) ? data.map((t) => t.tool) : [];
    return { action: 'status', status: 'tool_start', tools: toolNames };
  }

  if (eventType === 'metadata') {
    const data = evt.data as Record<string, unknown> | undefined;
    const chatId = data?.chatId as string | undefined;
    if (chatId) {
      return { action: 'set_chat_id', chatId };
    }
    return { action: 'noop' };
  }

  if (eventType === 'error') {
    return { action: 'error', content: (evt.data as string) || '' };
  }

  if (eventType === 'end') {
    return { action: 'done', content: '' };
  }

  return { action: 'noop' };
}
