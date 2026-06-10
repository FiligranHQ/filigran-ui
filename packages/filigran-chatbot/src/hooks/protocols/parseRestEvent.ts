import type { ChatAttachment, ToolCallTraceEntry, TransferChainEntry } from '../../types';
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
 * Normalize the raw `tool_call_trace` array (from a `done` event or restored
 * session metadata) into typed {@link ToolCallTraceEntry} objects. Defensive:
 * skips entries without a `name`. Returns `undefined` when empty so the
 * reasoning-details dialog falls back to the flat tool-name list.
 */
export function parseToolCallTrace(raw: unknown): ToolCallTraceEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ToolCallTraceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name) continue;
    out.push({
      name: e.name,
      input: typeof e.input === 'string' ? e.input : undefined,
      output: typeof e.output === 'string' ? e.output : undefined,
      success: e.success !== false,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize the raw `transfer_chain` array (from a `done` event or restored
 * session metadata) into typed {@link TransferChainEntry} objects.
 */
export function parseTransferChain(raw: unknown): TransferChainEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TransferChainEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.agent_name !== 'string' || !e.agent_name) continue;
    out.push({
      agentId: typeof e.agent_id === 'string' ? e.agent_id : '',
      agentName: e.agent_name,
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
    if (st === 'tool_heartbeat') {
      // Liveness signal during a long tool execution (background tasks,
      // consults, big integration calls): carries the elapsed seconds but
      // no new semantic state — the consumer must keep its current label.
      return {
        action: 'status',
        status: 'tool_heartbeat',
        tools: evt.tools as string[] | undefined,
        elapsedS: typeof evt.elapsed_s === 'number' ? evt.elapsed_s : undefined,
      };
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
      reasoning: typeof evt.reasoning === 'string' ? evt.reasoning : undefined,
      toolCallTrace: parseToolCallTrace(evt.tool_call_trace),
      transferChain: parseTransferChain(evt.transfer_chain),
      isTruncated: evt.is_truncated === true || undefined,
    };
  }

  return { action: 'noop' };
}
