import type { ChatAttachment, ToolCallTraceEntry, TransferChainEntry } from '../../types';

/**
 * Normalized action produced by all protocol parsers.
 * The SSE read loop is protocol-agnostic — only the JSON-to-action mapping differs.
 */
export type ParsedAction =
  | { action: 'status'; status: string; tools?: string[]; thinkingContent?: string; elapsedS?: number }
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
