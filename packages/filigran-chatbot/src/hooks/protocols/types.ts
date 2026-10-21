import type {
  ChatArtifact,
  ChatAttachment,
  ChatContextUsage,
  ChatMessage,
  ToolApprovalProposal,
  ToolCallTraceEntry,
  TransferChainEntry,
} from '../../types';
import type { PageAction } from '../../utils/pageActions';

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
      /** A turn re-attached mid-way (`thinking.resumed`): `elapsedS` is how long it has run. */
      resumed?: boolean;
      /** `wait_start`: how long the agent pauses, and why. */
      waitSeconds?: number;
      waitReason?: string;
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
      /** The decks, reports and videos the answer made (`artifacts`). */
      artifacts?: ChatArtifact[];
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
      /** Persisted id of the answer (`message_id`), what its feedback is stored against. */
      messageId?: string;
      /** A segment closed mid-turn: the turn goes on after it. */
      intermediate?: boolean;
      /** The agent that wrote this segment, when it is not the conversation's own. */
      answeredBy?: string;
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
  | {
      /**
       * `act_on_page` (#5559) asks the widget to act on the host page and answer
       * with a fresh snapshot. Not terminal: the turn waits on the same stream.
       */
      action: 'page_action_required';
      actionId: string;
      pageAction: PageAction;
      conversationId?: string;
    }
  | { action: 'error'; content: string }
  /** The turn was stopped (`cancelled`): terminal. */
  | { action: 'cancelled' }
  /** Nothing is waiting on a decision any more: another device answered it. */
  | { action: 'approval_resolved' }
  /** A user message sent from another device or tab. */
  | { action: 'user_message'; message: ChatMessage }
  | { action: 'conversation_title'; conversationId?: string; title: string }
  /** The message sent joined a turn already running, whose frames follow. */
  | { action: 'folded'; turnId?: string }
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
