import type { ChatAttachment } from '../../types';
import type { ParsedAction, ProtocolContext } from './types';

/**
 * Normalize the raw `attachments` array from a backend `done` event into
 * typed {@link ChatAttachment} objects. Defensive: skips non-object entries
 * and entries without a `file_id`. Returns `undefined` when there is nothing
 * renderable so the `done` action stays lean for backends without #810.
 */
export function parseAttachments(raw: unknown): ChatAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChatAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const fileId = a.file_id;
    if (typeof fileId !== 'string' || !fileId) continue;
    out.push({
      fileId,
      filename: typeof a.filename === 'string' ? a.filename : 'file',
      type: typeof a.type === 'string' ? a.type : undefined,
      size: typeof a.size === 'number' ? a.size : undefined,
      contentType: typeof a.content_type === 'string' ? a.content_type : undefined,
      fileTag: a.file_tag === 'working_file' ? 'working_file' : 'download_file',
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Parse an XTM One (REST) SSE event into a normalized action.
 */
export function parseRestEvent(evt: Record<string, unknown>, ctx: ProtocolContext): ParsedAction {
  const type = evt.type as string | undefined;

  if (type === 'error') {
    return { action: 'error', content: (evt.content as string) || '' };
  }

  if (type === 'status') {
    const st = evt.status as string;
    if (st === 'tool_done' || st === 'wind_down') {
      return { action: 'noop' };
    }
    if (st === 'streaming') {
      return { action: 'status', status: 'streaming' };
    }
    if (st === 'thinking_text') {
      return { action: 'status', status: 'thinking_text', thinkingContent: evt.content as string };
    }
    if (st === 'tool_start') {
      ctx.hasUsedTools = true;
      return { action: 'status', status: 'tool_start', tools: evt.tools as string[] | undefined };
    }
    if (st === 'thinking' && ctx.hasUsedTools) {
      return { action: 'status', status: 'analyzing' };
    }
    return { action: 'status', status: st, tools: evt.tools as string[] | undefined };
  }

  if (type === 'stream') {
    return { action: 'stream', content: evt.content as string };
  }

  if (type === 'done') {
    return {
      action: 'done',
      content: evt.content as string,
      conversationId: evt.conversation_id as string | undefined,
      toolNames: evt.tool_names as string[] | undefined,
      toolCallCount: evt.tool_call_count as number | undefined,
      iterations: evt.iterations as number | undefined,
      transferAgentId: evt.transfer_agent_id as string | undefined,
      transferAgentName: evt.transfer_agent_name as string | undefined,
      attachments: parseAttachments(evt.attachments),
    };
  }

  return { action: 'noop' };
}
