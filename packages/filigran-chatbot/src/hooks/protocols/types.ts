import type { ChatAttachment, ChatContextUsage, ToolApprovalProposal, ToolCallTraceEntry, TransferChainEntry } from '../../types';

/**
 * Normalized action produced by all protocol parsers.
 * The SSE read loop is protocol-agnostic — only the JSON-to-action mapping differs.
 */
export type ParsedAction =
  | {
      action: 'status';
      status: string;
      tools?: string[];
      thinkingContent?: string;
      elapsedS?: number;
      /**
       * Context-window occupancy reported alongside a progress event, so the
       * composer gauge climbs during a long turn instead of only at the end.
       * Orthogonal to `status` — the consumer updates the gauge and applies the
       * status label independently.
       */
      contextUsage?: ChatContextUsage;
    }
  | { action: 'stream'; content: string }
  | {
      action: 'done';
      content: string;
      conversationId?: string;
      toolNames?: string[];
      toolCallCount?: number;
      iterations?: number;
      transferAgentId?: string;
      transferAgentName?: string;
      attachments?: ChatAttachment[];
      /** Accumulated model reasoning for the turn (reasoning-details dialog). */
      reasoning?: string;
      /** Per-tool-call execution trace (reasoning-details dialog). */
      toolCallTrace?: ToolCallTraceEntry[];
      /** Agent transfer chain for the turn (reasoning-details dialog). */
      transferChain?: TransferChainEntry[];
      /** True when the agent's iteration budget was exhausted. */
      isTruncated?: boolean;
      /** Closing context-window occupancy for the turn. */
      contextUsage?: ChatContextUsage;
    }
  | {
      /**
       * The turn has stopped at a gated tool call and is holding the stream
       * open, silent, until a decision is POSTed back. Not a terminal action:
       * the same stream carries the rest of the turn once the answer arrives.
       */
      action: 'approval_required';
      proposals: ToolApprovalProposal[];
      /**
       * The conversation the paused turn belongs to, as the backend knows it.
       * Carried on the event because the very first turn of a fresh
       * conversation has not yet learned its own id — that normally arrives on
       * `done`, which a paused turn has not reached.
       */
      conversationId?: string;
    }
  | { action: 'error'; content: string }
  | { action: 'set_chat_id'; chatId: string }
  | { action: 'noop' };

/**
 * Mutable context shared across events within a single SSE stream.
 * Protocols can read/write this to track cross-event state.
 */
export interface ProtocolContext {
  hasUsedTools: boolean;
  activeNodeId: string;
}
