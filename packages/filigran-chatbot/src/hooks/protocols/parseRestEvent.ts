import type {
  ChatAttachment,
  ChatContextBreakdown,
  ChatContextUsage,
  ChatConversationRef,
  ChatMessage,
  ChatMessagePersistedFeedback,
  ToolApprovalProposal,
  ToolCallTraceEntry,
  TransferChainEntry,
} from '../../types';
import type { ParsedAction, ProtocolContext } from './types';

/** Wire key → the breakdown field it populates. */
const BREAKDOWN_KEYS: ReadonlyArray<[string, keyof ChatContextBreakdown]> = [
  ['system', 'system'],
  ['tools', 'tools'],
  ['dynamic_tools', 'dynamicTools'],
  ['summary', 'summary'],
  ['conversation', 'conversation'],
  ['tool_results', 'toolResults'],
];

/**
 * Normalize the optional `context_breakdown` object.
 *
 * Only positive numbers for keys we know how to label survive: an unlabelled
 * bucket cannot be rendered, and a zero one is noise in a list meant to show
 * where the context actually went. Returns `undefined` when nothing usable is
 * left, so the gauge keeps its number and simply has no detail to open.
 */
function parseBreakdown(raw: unknown): ChatContextBreakdown | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: ChatContextBreakdown = {};
  let any = false;
  for (const [wireKey, field] of BREAKDOWN_KEYS) {
    const value = src[wireKey];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out[field] = value;
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Read the context-window occupancy carried by a progress or `done` frame.
 *
 * Both halves are required and the window must be positive: a token count with
 * no window to measure it against is not a ratio, and a zero window would make
 * one out of a division by zero. Returns `undefined` for anything else, so a
 * backend that reports nothing simply leaves the gauge as it was.
 */
export function parseContextUsage(evt: Record<string, unknown>): ChatContextUsage | undefined {
  const used = evt.context_tokens;
  const limit = evt.context_window;
  if (typeof used !== 'number' || typeof limit !== 'number') return undefined;
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0 || used < 0) return undefined;
  const breakdown = parseBreakdown(evt.context_breakdown);
  return breakdown ? { used, limit, breakdown } : { used, limit };
}

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
      // Only a boolean is honored; a missing/malformed value defaults to
      // success so unknown states never render a false failure icon.
      success: typeof e.success === 'boolean' ? e.success : true,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize the `conversation_refs` of a restored user message: the
 * conversations it referenced with `@`, as the backend recorded them. An entry
 * without a conversation id is skipped; `undefined` when nothing is left.
 */
export function parseConversationRefs(raw: unknown): ChatConversationRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChatConversationRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.conversation_id !== 'string' || !r.conversation_id) continue;
    if (out.some((o) => o.conversationId === r.conversation_id)) continue;
    out.push({
      conversationId: r.conversation_id,
      title: typeof r.title === 'string' ? r.title.trim() : '',
      key: typeof r.key === 'string' ? r.key : '',
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
 * Normalize the `proposals` array of an `approval_required` event.
 *
 * Only `tool_call_id` is load-bearing — it is what a decision is keyed on, so
 * an entry without one could never be answered and is dropped. Everything else
 * degrades: a proposal with no name still renders under a placeholder rather
 * than vanishing, because a call silently hidden from the reviewer is a call
 * that stalls the turn with nothing on screen to explain it.
 *
 * Returns `undefined` when nothing decidable is left, so the consumer can treat
 * an unusable pause as one it must not claim to have prompted for.
 */
export function parseToolApprovalProposals(raw: unknown): ToolApprovalProposal[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ToolApprovalProposal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const toolCallId = p.tool_call_id;
    if (typeof toolCallId !== 'string' || !toolCallId) continue;
    const args = p.arguments;
    const schema = p.input_schema;
    out.push({
      toolCallId,
      // Left empty for the UI to label: a parser has no `t`, and a placeholder
      // baked in here would reach the reviewer untranslated.
      toolName: typeof p.tool_name === 'string' && p.tool_name ? p.tool_name : '',
      toolDescription: typeof p.tool_description === 'string' ? p.tool_description : undefined,
      arguments: args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {},
      inputSchema: schema && typeof schema === 'object' && !Array.isArray(schema) ? (schema as Record<string, unknown>) : undefined,
      source: typeof p.source === 'string' ? p.source : undefined,
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
    // Context occupancy rides on the per-iteration `thinking` frame, so the
    // gauge climbs during a long turn. Read before the `analyzing` relabel
    // below, which rewrites the status but not what the frame carries.
    const contextUsage = parseContextUsage(evt);
    if (st === 'thinking' && ctx.hasUsedTools) {
      return { action: 'status', status: 'analyzing', contextUsage };
    }
    return { action: 'status', status: st, tools: evt.tools as string[] | undefined, contextUsage };
  }

  // The turn has paused on a gated tool call. Deliberately NOT terminal: the
  // stream stays open (kept warm by SSE `: keepalive` comment lines, which the
  // reader below drops as non-`data:` lines) and the rest of the turn arrives
  // on it once a decision is POSTed back.
  if (type === 'approval_required') {
    const proposals = parseToolApprovalProposals(evt.proposals);
    if (!proposals) return { action: 'noop' };
    return {
      action: 'approval_required',
      proposals,
      conversationId: typeof evt.conversation_id === 'string' ? evt.conversation_id : undefined,
    };
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
      contextUsage: parseContextUsage(evt),
      messageId: typeof evt.message_id === 'string' && evt.message_id ? evt.message_id : undefined,
    };
  }

  return { action: 'noop' };
}

/** The `feedback` of a restored entry, or undefined for anything that is not a stored rating. */
export function parsePersistedFeedback(raw: unknown): ChatMessagePersistedFeedback | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { rating, comment } = raw as { rating?: unknown; comment?: unknown };
  if (rating !== 'positive' && rating !== 'negative') return undefined;
  return { rating, comment: typeof comment === 'string' && comment.trim() ? comment : null };
}

/**
 * The messages of a session restore (`POST {sessions}` with a known
 * `conversation_id`), in order.
 *
 * Rows are keyed `restored-<index>`: the key only has to be stable for the
 * life of the transcript, and a restore replaces the transcript whole. The
 * entry's own `id` is the message's persisted id, kept as `serverId` for what
 * is stored against it (feedback); its `created_at` is when it was sent, and
 * a backend that sends neither still restores - with no time to show
 * (`timestampUnknown`) rather than the time of the restore.
 * Entries that are not a user or an assistant message are skipped.
 */
export function parseRestoredMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  raw.forEach((item: unknown, i: number) => {
    if (!item || typeof item !== 'object') return;
    const m = item as Record<string, unknown>;
    if (m.role !== 'user' && m.role !== 'assistant') return;
    const createdAt = typeof m.created_at === 'string' ? new Date(m.created_at) : null;
    const sentAt = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null;
    out.push({
      id: `restored-${i}`,
      serverId: typeof m.id === 'string' && m.id ? m.id : undefined,
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      timestamp: sentAt ?? new Date(),
      timestampUnknown: sentAt ? undefined : true,
      feedback: m.role === 'assistant' ? parsePersistedFeedback(m.feedback) : undefined,
      // Per-message attribution when the backend keeps it — the only way a
      // thread that changed hands mid-way reads correctly. Nothing records it
      // today, so this is normally undefined and the conversation's agent
      // applies to the whole thread.
      agentName: typeof m.agent_name === 'string' ? m.agent_name : undefined,
      // Downloadable file chips on both roles: agent-generated deliverables on
      // assistant messages (their [[FILE:…]] markers are stripped at render
      // time) and user uploads, so an upload stays downloadable after a reload
      // and not only in the live session where it is carried on `files`.
      attachments: parseAttachments(m.attachments),
      // The conversations a user message referenced with `@`, shown as chips.
      conversationRefs: m.role === 'user' ? parseConversationRefs(m.conversation_refs) : undefined,
      // The reasoning-details affordance, from the same fields the live `done`
      // event carries.
      toolNames: Array.isArray(m.tool_names) ? (m.tool_names as string[]) : undefined,
      toolCallCount: typeof m.tool_call_count === 'number' ? m.tool_call_count : undefined,
      iterations: typeof m.iterations === 'number' ? m.iterations : undefined,
      reasoning: typeof m.reasoning === 'string' ? m.reasoning : undefined,
      toolCallTrace: parseToolCallTrace(m.tool_call_trace),
      transferChain: parseTransferChain(m.transfer_chain),
      isTruncated: m.is_truncated === true || undefined,
    });
  });
  return out;
}
