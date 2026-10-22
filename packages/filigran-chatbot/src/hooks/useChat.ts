import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentStatusState,
  ApiEndpoints,
  ChatSendDecision,
  ChatSendDraft,
  ChatSendOutcome,
  ChatHeldOutcome,
  BackendType,
  ChatContextUsage,
  ChatConversationRef,
  ChatFile,
  ChatMessage,
  ToolApprovalDecision,
  ToolApprovalProposal,
} from '../types';
import type { ParsedAction, ProtocolContext } from './protocols';
import { parseAgUiEvent, parseLegacyEvent, parseRestEvent } from './protocols';
import { parseToolApprovalProposals } from './protocols/parseRestEvent';
import { createStreamDeltas, type StreamDeltas } from './streamDeltas';
import { createSessionGate } from '../utils/sessionGate';
import { conversationReferencesUrl, pruneConversationRefs, referencedConversations, withConversationRef } from '../utils/conversationRefs';
import { hostTakesPageActions, performPageAction, waitForDomSettle, type PageAction } from '../utils/pageActions';
import { takePageSnapshot } from '../utils/pageSnapshot';
import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from '../utils/storage';
import { readSseEvents } from '../utils/sse';
import { randomId } from '../utils/randomId';
import { readRefusalDetail, requestHeadersKey } from '../utils/refusal';
import { mentionedAgentIds, pruneAgentMentions, withAgentMention, type AgentMention } from '../utils/agentMentions';

// Unsent composer text is kept per conversation so closing the panel (hosts
// unmount `<ChatPanel/>` when it is closed) or switching conversation doesn't
// discard a half-written question. `sessionStorage`, not `localStorage`: a
// draft is scoped to the tab and dies with it.

/** Debounce on draft writes so a fast typist doesn't hit storage per keystroke. */
const DRAFT_PERSIST_DELAY_MS = 300;

const draftKey = (prefix: string | undefined, conversationId: string | null): string =>
  storageKey(prefix, `${STORAGE_KEYS.draft}${conversationId ?? 'new'}`);

/**
 * The `@` picks of a draft, kept beside its text: only a pick makes `@key`
 * reference a conversation, so a draft restored without them would go out with
 * its `@key`s as plain text.
 */
const draftRefsKey = (prefix: string | undefined, conversationId: string | null): string =>
  storageKey(prefix, `${STORAGE_KEYS.draftRefs}${conversationId ?? 'new'}`);

function loadDraftRefs(prefix: string | undefined, conversationId: string | null): ChatConversationRef[] {
  try {
    const parsed: unknown = JSON.parse(readStorage('session', draftRefsKey(prefix, conversationId)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ChatConversationRef =>
        !!r && typeof r === 'object' && typeof r.conversationId === 'string' && typeof r.key === 'string' && typeof r.title === 'string',
    );
  } catch {
    return [];
  }
}

function persistDraft(prefix: string | undefined, conversationId: string | null, value: string, refs: ChatConversationRef[]): void {
  writeStorage('session', draftKey(prefix, conversationId), value);
  writeStorage('session', draftRefsKey(prefix, conversationId), refs.length > 0 ? JSON.stringify(refs) : null);
}

/** A conversation's draft: its text and the `@` picks it still holds. */
function loadDraftState(prefix: string | undefined, conversationId: string | null): { text: string; refs: ChatConversationRef[] } {
  const text = readStorage('session', draftKey(prefix, conversationId)) ?? '';
  return { text, refs: pruneConversationRefs(loadDraftRefs(prefix, conversationId), text) };
}

/**
 * How often to check on a turn resumed by a decision made on a recovered
 * (streamless) prompt, and the backstop that ends the watch regardless.
 *
 * Such a turn has no stream left to write to — the backend persists the answer
 * and suppresses the live `done` frame — so the panel watches the pause-recovery
 * route instead, which reports whether the turn is still running. That is a
 * definite stop condition rather than a guess at how long an agent might take,
 * and each poll doubles as the sign of life that keeps the turn from being
 * abandoned. The deadline is only a backstop against a turn-state marker that
 * somehow never clears; the ordinary end is the turn reporting itself idle.
 */
const RESUME_POLL_MS = 5000;
const RESUME_WATCH_MS = 900000;

/**
 * How often to re-assert that somebody is still here while a recovered prompt
 * is on screen.
 *
 * A paused turn gives up after 30 minutes with no sign of a client, and after a
 * reload the stream that would have vouched for the reviewer is gone for good —
 * so presence is inferred from requests about the conversation instead. A tab
 * left open on the prompt IS a client present, but it makes no requests, so
 * without this the turn would abandon a reviewer who is simply taking their
 * time. Well inside the server's window, since missing it costs the whole turn.
 */
const APPROVAL_PRESENCE_INTERVAL_MS = 600000;

/** How long a dropped turn waits for the event stream to bring it back before reading the history. */
const HANDOVER_GRACE_MS = 15000;
/** How long Stop waits for the backend to end a cancelled turn before letting go of it. */
const CANCEL_GRACE_MS = 10000;
/** Reconnection backoff of the conversation's event stream. */
const EVENTS_RETRY_BASE_MS = 1000;
const EVENTS_RETRY_MAX_MS = 30000;
/**
 * How long the page may stay hidden before its event stream is closed. Under
 * HTTP/1.1 a browser holds six connections per origin, and a background tab
 * keeping one open starves the tabs in use; shown again, the stream reopens
 * and the conversation is read back.
 */
const EVENTS_HIDDEN_CLOSE_MS = 60000;

/** The actions that belong to a turn, as opposed to the conversation. */
const TURN_ACTIONS: ReadonlySet<ParsedAction['action']> = new Set(['status', 'stream', 'done', 'approval_required', 'error', 'cancelled']);

/** The message body's fields the panel owns: a host's extras cannot set them. */
const PANEL_FIELDS: ReadonlySet<string> = new Set([
  'mentioned_agent_ids',
  'content',
  'conversation_id',
  'agent_slug',
  'supports_tool_approval',
  'supports_page_actions',
  'supports_artifacts',
  'referenced_conversation_ids',
  'file_ids',
  'context',
]);

/** *next* added to the message already held: one message, sent when the turn ends. */
function mergeHeld(prev: HeldMessage | null, next: HeldMessage): HeldMessage {
  if (!prev) return next;
  const refIds = new Set(prev.refs.map((r) => r.conversationId));
  const mentionIds = new Set(prev.mentions.map((m) => m.agentId));
  return {
    text: [prev.text, next.text].filter(Boolean).join('\n\n'),
    draft: [prev.draft, next.draft].filter(Boolean).join('\n\n'),
    files: [...prev.files, ...next.files],
    refs: [...prev.refs, ...next.refs.filter((r) => !refIds.has(r.conversationId))],
    mentions: [...prev.mentions, ...next.mentions.filter((m) => !mentionIds.has(m.agentId))],
    extras: prev.extras || next.extras ? { ...prev.extras, ...next.extras } : undefined,
    displayText:
      prev.displayText !== undefined || next.displayText !== undefined
        ? [prev.displayText ?? prev.text, next.displayText ?? next.text].filter(Boolean).join('\n\n')
        : undefined,
    onSent:
      prev.onSent && next.onSent
        ? () => {
            prev.onSent!();
            next.onSent!();
          }
        : (prev.onSent ?? next.onSent),
  };
}

/** A send once `onBeforeSend` had its say: what is sent, what the user's bubble shows, the host's fields. */
export interface DecidedSend {
  text: string;
  displayText: string;
  extras?: Record<string, unknown>;
}

/**
 * Apply `onBeforeSend`'s *decision* to *text*: `null` when the host took the
 * send over. The bubble shows `displayText` when the host gave one that says
 * something, else *displayFallback* (the handle's `displayText`) when it
 * does, the text sent otherwise.
 */
export function applySendDecision(text: string, decision: ChatSendDecision | undefined, displayFallback?: string): DecidedSend | null {
  if (decision === false) return null;
  const adjust = decision && typeof decision === 'object' ? decision : undefined;
  const sent = (typeof adjust?.text === 'string' ? adjust.text : text).trim();
  const shown = typeof adjust?.displayText === 'string' ? adjust.displayText.trim() : '';
  const fallback = typeof displayFallback === 'string' ? displayFallback.trim() : '';
  return { text: sent, displayText: shown || fallback || sent, extras: adjust?.extras };
}

/** A host callback's answer; one that throws is reported and answers nothing, never breaking the turn. */
export function askHost<A extends unknown[], R>(callback: ((...args: A) => R) | undefined, ...args: A): R | undefined {
  if (!callback) return undefined;
  try {
    return callback(...args);
  } catch (err) {
    console.error('A chat panel host callback threw', err);
    return undefined;
  }
}

/** The host's extra body fields, read at send time; a throwing getter sends none. */
function readRequestExtras(getter: (() => Record<string, unknown> | undefined) | undefined): Record<string, unknown> {
  try {
    const extras = getter?.();
    return extras && typeof extras === 'object' ? extras : {};
  } catch {
    return {};
  }
}

/** Maximum number of files that can be attached to a single message. */
const DEFAULT_MAX_FILE_COUNT = 10;
/** Maximum total size of all attached files (50 MB). */
const DEFAULT_MAX_TOTAL_SIZE = 50 * 1024 * 1024;

interface UseChatOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  agentSlug: string | null | undefined;
  requestHeaders?: Record<string, string>;
  /** Arbitrary host page/application context, sent as `context` on the REST message body. */
  pageContext?: Record<string, unknown>;
  /** The host's in-app navigation, which `act_on_page` uses to open a path (#5559). */
  onRelativeLinkClick?: (href: string) => void;
  t: (key: string) => string;
  maxFileCount?: number;
  maxTotalSize?: number;
  /** Namespace of the browser-storage keys (see `storageKeyPrefix` on the panel). */
  storageKeyPrefix?: string;
  /**
   * The conversation the host holds, when it controls it: `undefined` leaves the
   * panel on its own persisted one. A controlled id is never written to storage.
   */
  controlledConversationId?: string | null;
  /** Called whenever the active conversation changes, whoever changed it. */
  onConversationIdChange?: (id: string | null) => void;
  /** Extra fields merged into each REST message body (see `getRequestExtras` on the panel). */
  getRequestExtras?: () => Record<string, unknown> | undefined;
  /** Every frame of the message stream and the event stream, as received. */
  onStreamEvent?: (event: Record<string, unknown>, info: { relayed: boolean }) => void;
  /** A conversation was retitled (`conversation_title`). */
  onConversationTitle?: (conversationId: string | null, title: string) => void;
  /**
   * The conversation whose history is on screen: its event stream is followed
   * only then, so a relayed turn is appended to that history.
   */
  historySettledFor?: string | null;
  /** A steer may carry the composer's uploaded files (`file_ids`). */
  steerAttachments?: boolean;
  /** A message that cannot steer the running turn is held, and sent when it ends. */
  holdSends?: boolean;
  /** `@` can mention agents: the message then carries `mentioned_agent_ids`. */
  agentMentionsEnabled?: boolean;
  /** Sees every send first (see `onBeforeSend` on the panel). */
  onBeforeSend?: (draft: ChatSendDraft) => ChatSendDecision;
  /** Told what became of a held message (see `onHeldSendSettled` on the panel). */
  onHeldSendSettled?: (text: string, outcome: ChatHeldOutcome) => void;
}

/** What a host-driven or held send carries, in place of the composer's content. */
export interface SendOverride {
  text: string;
  extras?: Record<string, unknown>;
  files?: ChatFile[];
  refs?: ChatConversationRef[];
  mentions?: AgentMention[];
  /** Already seen by `onBeforeSend` (a held message going out). */
  decided?: boolean;
  /**
   * What the user's bubble shows in place of `text` (see `ChatSendDecision`):
   * a held message's, or the handle's own, which `onBeforeSend`'s wins over.
   */
  displayText?: string;
  /** Called as the message opens a turn, long before the send itself resolves at the turn's end. */
  onSent?: () => void;
  /** Called once the message steered the running turn, with the turn the backend named (`null`: none). */
  onSteered?: (turnId: string | null) => void;
  /** Who sends it, as `onBeforeSend` is told: the host (default) or a voice call. */
  source?: 'host' | 'voice';
}

/** A message waiting for the running turn to end. */
export interface HeldMessage {
  text: string;
  /** What the user typed for it, as typed: what Stop gives back. Empty for a host's send. */
  draft: string;
  files: ChatFile[];
  refs: ChatConversationRef[];
  mentions: AgentMention[];
  extras?: Record<string, unknown>;
  /** What the user's bubble shows in place of `text`, when the host said. */
  displayText?: string;
  /** Told as the message goes out (see `SendOverride.onSent`). */
  onSent?: () => void;
}

export interface TransferredAgent {
  id: string;
  name: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  agentStatus: AgentStatusState | null;
  attachedFiles: ChatFile[];
  conversationId: string | null;
  /**
   * Context-window occupancy for the active conversation, or `null` while the
   * backend has reported none (a fresh chat, or a backend that does not carry
   * the figures at all). Tracked live off the per-iteration progress frames and
   * finalised on `done`.
   */
  contextUsage: ChatContextUsage | null;
  transferredAgent: TransferredAgent | null;
  /**
   * True while a response is streaming AND the typed text can be dispatched
   * immediately as a mid-run steering message (REST backend with a steer
   * endpoint and a known conversation id). Gates the steering affordances in
   * the composer (accent Send next to Stop, "Enter to send now" copy).
   */
  canSteer: boolean;
  /**
   * Tool calls the running turn has stopped on, or `null` when nothing is
   * waiting. While set, the turn is paused mid-answer: the stream is open and
   * silent, and only a decision (or aborting the turn) moves it on.
   */
  pendingApprovals: ToolApprovalProposal[] | null;
  /** True while a decision set is in flight to the approve endpoint. */
  isSubmittingApproval: boolean;
  /**
   * Why the last decision submission failed, or `null`. Kept alongside the
   * still-visible prompt rather than replacing it: the turn is paused either
   * way, so the reviewer needs the retry as much as the explanation.
   */
  approvalError: string | null;
  /**
   * Answer a paused turn. Every proposed call must appear exactly once — the
   * backend refuses a partial set, because resuming with an undecided call
   * leaves a `tool_use` block without its `tool_result`, which the model
   * providers reject outright.
   */
  submitApprovalDecisions: (decisions: ToolApprovalDecision[]) => Promise<void>;
  /**
   * True while waiting for the answer to a decision made on a recovered prompt.
   * The turn resumed without a stream to report on, so the panel shows the
   * working indicator itself and re-reads the conversation until the answer
   * lands.
   */
  isResumingAfterDecision: boolean;
  /**
   * Bumped whenever the conversation must be re-read from the server. The panel
   * owns the restore, so this is how the hook asks for one.
   */
  historyReloadNonce: number;
  historyLoadedRef: React.MutableRefObject<boolean>;
  /**
   * Ref mirror of {@link conversationId}, always current across async
   * boundaries. Exposed so the history-restore effect can tell, when its
   * `/chat/sessions` response arrives, whether the conversation it was issued
   * for is still the active one — and ignore a genuinely superseded response
   * (new chat / agent switch) without discarding a restore that was merely
   * torn down by a benign host re-render or a StrictMode double-invoke.
   */
  conversationIdRef: React.MutableRefObject<string | null>;
  handleFileAdd: (fileList: FileList | null) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  /**
   * The text a user message was sent with, when its bubble shows other words
   * (`displayText`): what the backend stored, and echoes back.
   */
  sentTextOf: (message: ChatMessage) => string;
  /** Send the composer's content, or *override*'s without touching the composer. */
  handleSendMessage: (override?: SendOverride) => Promise<ChatSendOutcome>;
  /** A message held until the running turn ends (`holdSends`), if any. */
  heldMessage: HeldMessage | null;
  cancelHeldMessage: () => void;
  /** Read the conversation back from the server again. */
  reloadHistory: () => void;
  /** The agents picked from the `@` menu whose `@key` the draft still holds. */
  agentMentions: AgentMention[];
  addAgentMention: (mention: AgentMention) => void;
  /** End an agent's wait early ("Continue now"); `null` when the host offers no route. */
  skipWait: (() => Promise<void>) | null;
  /**
   * Start a fresh conversation; with *workspaceId* (a string), the session is
   * created inside that workspace (`workspace_id` on the session `POST`).
   */
  handleNewChat: (workspaceId?: string) => void;
  /** The workspace the next conversation will be created in, if any. */
  pendingWorkspaceId: string | null;
  /** Forget *workspaceId* as the next conversation's workspace (it was deleted). */
  clearPendingWorkspace: (workspaceId: string) => void;
  handleStopGenerating: () => void;
  /**
   * The conversations picked from the composer's `@` menu whose `@key` the
   * draft still holds; sent as `referenced_conversation_ids` with the next
   * message.
   */
  conversationRefs: ChatConversationRef[];
  /** Record a pick from the `@` menu. */
  addConversationRef: (ref: ChatConversationRef) => void;
  setAttachedFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /**
   * Seed the context gauge from outside a live turn — the history-restore path,
   * which reads the newest restored assistant message's figures.
   */
  setContextUsage: React.Dispatch<React.SetStateAction<ChatContextUsage | null>>;
  /**
   * Set (or clear) the active conversation id, keeping React state, the
   * cross-async-boundary ref mirror, and localStorage all in sync. Pass
   * `null` to reset. Prefer this over a raw state setter so the id consumed
   * by `handleSendMessage` (which reads the ref) never drifts from what the
   * UI shows.
   */
  updateConversationId: (id: string | null) => void;
  /**
   * Switch to another existing conversation (history menu). Aborts any
   * in-flight request, clears the transcript, and re-arms the history-restore
   * effect so the selected conversation's messages are fetched via the
   * sessions endpoint.
   */
  handleSwitchConversation: (id: string) => void;
}

function getParser(backendType: BackendType): (evt: Record<string, unknown>, ctx: ProtocolContext) => ParsedAction {
  switch (backendType) {
    case 'legacy':
      return parseLegacyEvent;
    case 'ag-ui':
      return parseAgUiEvent;
    default:
      return parseRestEvent;
  }
}

export function buildRequestBody(
  backendType: BackendType,
  content: string,
  opts: {
    legacyChatId: string | null;
    conversationId: string | null;
    agentSlug: string | null | undefined;
    pageContext?: Record<string, unknown>;
    /** See {@link ApiEndpoints.approve} — derived, never a prop of its own. */
    supportsToolApproval?: boolean;
    /** See {@link ApiEndpoints.conversationReferences}. */
    referencedConversationIds?: string[];
    /** Same promise, for `act_on_page` frames (#5559): answered on the approve path. */
    supportsPageActions?: boolean;
    /** The host's own fields; never overriding the panel's. */
    extras?: Record<string, unknown>;
  },
): Record<string, unknown> {
  switch (backendType) {
    case 'legacy':
      return { question: content, chatId: opts.legacyChatId ?? undefined, streaming: true };
    case 'ag-ui':
      return {
        threadId: opts.conversationId ?? crypto.randomUUID(),
        runId: crypto.randomUUID(),
        messages: [{ id: crypto.randomUUID(), role: 'user', content }],
        tools: [],
        context: [],
        state: {},
        forwardedProps: opts.agentSlug ? { agentSlug: opts.agentSlug } : {},
      };
    default: {
      // The host's fields never stand in for the panel's own, set or not.
      const hostFields = Object.fromEntries(Object.entries(opts.extras ?? {}).filter(([key]) => !PANEL_FIELDS.has(key)));
      const body: Record<string, unknown> = { ...hostFields, content, conversation_id: opts.conversationId, agent_slug: opts.agentSlug };
      // Tell the backend this turn may pause on a gated tool call and that we
      // will answer. Sent only when the host named an approve path, because
      // the flag is a promise: a backend that pauses waits indefinitely, so a
      // client that cannot answer must never claim it can. Omitted rather than
      // sent false, so a proxy that rebuilds the body from a fixed field list
      // drops nothing meaningful.
      if (opts.supportsToolApproval) {
        body.supports_tool_approval = true;
      }
      // Only when the message holds a pick: a host that never named the route
      // sends exactly the body it always did.
      if (opts.referencedConversationIds && opts.referencedConversationIds.length > 0) {
        body.referenced_conversation_ids = opts.referencedConversationIds;
      }
      if (opts.supportsPageActions) {
        body.supports_page_actions = true;
      }
      // The panel renders the deck, report and video markers itself whatever
      // the host proxies: the cards need no route to show and link to XTM One.
      body.supports_artifacts = true;
      // Forward arbitrary host page context (e.g. current URL) so the agent
      // knows where the user is. Omitted when empty to keep payloads lean.
      // Guard serialization: the whole body is later JSON.stringify'd, so a
      // non-serializable value (circular reference, BigInt, …) would otherwise
      // throw and break the message send. Drop the context instead — page
      // context is supplementary and must never prevent a message from going out.
      // Decide using the serialized result so values that normalize to an empty
      // object (e.g. `{ url: undefined }`, `{ fn: () => {} }`) are also omitted.
      if (opts.pageContext && Object.keys(opts.pageContext).length > 0) {
        try {
          const serialized = JSON.stringify(opts.pageContext);
          if (serialized && serialized !== '{}') {
            body.context = opts.pageContext;
          }
        } catch {
          // Non-serializable page context — skip it rather than fail the send.
        }
      }
      return body;
    }
  }
}

export function useChat({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  agentSlug,
  requestHeaders,
  pageContext,
  onRelativeLinkClick,
  t,
  maxFileCount = DEFAULT_MAX_FILE_COUNT,
  maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
  storageKeyPrefix,
  controlledConversationId,
  onConversationIdChange,
  getRequestExtras,
  onStreamEvent,
  onConversationTitle,
  historySettledFor = null,
  steerAttachments = false,
  holdSends = false,
  agentMentionsEnabled = false,
  onBeforeSend,
  onHeldSendSettled,
}: UseChatOptions): UseChatReturn {
  const isLegacy = backendType === 'legacy';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const isControlled = controlledConversationId !== undefined;
  const conversationStorageKey = storageKey(storageKeyPrefix, STORAGE_KEYS.conversationId);
  const legacyChatIdStorageKey = storageKey(storageKeyPrefix, STORAGE_KEYS.legacyChatId);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    isControlled ? (controlledConversationId ?? null) : readStorage('local', conversationStorageKey),
  );
  // Seeded from the persisted draft of whichever conversation we mount into,
  // so re-opening the panel restores what the user had typed - and the
  // conversations it references.
  const [initialDraft] = useState(() => loadDraftState(storageKeyPrefix, conversationId));
  const [inputValue, setInputValue] = useState(initialDraft.text);
  const [conversationRefs, setConversationRefs] = useState<ChatConversationRef[]>(initialDraft.refs);
  const [agentMentions, setAgentMentions] = useState<AgentMention[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  const [transferredAgent, setTransferredAgent] = useState<TransferredAgent | null>(null);
  // How full the model's context window is for this conversation. Conversation
  // state rather than per-message: it describes what the NEXT turn will carry,
  // which is the only thing the user can still act on.
  const [contextUsage, setContextUsage] = useState<ChatContextUsage | null>(null);
  // Tool calls the running turn is paused on. Conversation-level rather than
  // per-message: the pause belongs to the turn, not to any one bubble, and the
  // prompt outlives the segment that was streaming when it arrived.
  const [pendingApprovals, setPendingApprovals] = useState<ToolApprovalProposal[] | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // A prompt recovered after a reload is answered the same way, but resumes
  // differently: there is no stream left to carry the rest of the turn.
  const [isResumingAfterDecision, setIsResumingAfterDecision] = useState(false);
  const [historyReloadNonce, setHistoryReloadNonce] = useState(0);
  // Drives the resume watch's next poll: each tick re-arms the effect.
  const [resumeTick, setResumeTick] = useState(0);
  const [legacyChatId, setLegacyChatId] = useState<string | null>(() => readStorage('local', legacyChatIdStorageKey));

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Page actions abort on their own: closing the panel must stop them touching
  // the host page without cancelling the turn, whose answer a host expects to
  // find in history when the panel reopens.
  const pageActionControllerRef = useRef<AbortController | null>(null);
  // The running stream's pending deltas, so stopping it can apply them and a
  // new chat can drop them.
  const streamDeltasRef = useRef<StreamDeltas | null>(null);
  // The turn this panel streams itself, so the event stream never renders it
  // again, and the one of another origin it relays, if any.
  const ownTurnActiveRef = useRef(false);
  const ownTurnIdRef = useRef<string | null>(null);
  const relayedTurnRef = useRef<{ turnId: string | null; renderer: ReturnType<typeof createTurnRenderer> } | null>(null);
  // A Stop sent to the backend, and the backstop that lets go of the turn if
  // it never reports the end.
  const cancelTimerRef = useRef<number | null>(null);
  // The renderer of the turn on screen, this panel's own or a relayed one:
  // what Stop marks.
  const liveRendererRef = useRef<ReturnType<typeof createTurnRenderer> | null>(null);
  // A relayed turn stopped here: its later frames are not a new turn.
  const stoppedTurnIdRef = useRef<string | null>(null);
  // Stop was pressed: what was held goes back to the composer instead of out.
  const stopRequestedRef = useRef(false);
  // A message waiting for the running turn to end (`holdSends`).
  const [heldMessage, setHeldMessage] = useState<HeldMessage | null>(null);
  const heldMessageRef = useRef(heldMessage);
  heldMessageRef.current = heldMessage;
  // The text each user bubble showing other words was sent with, by bubble id.
  const sentTextRef = useRef(new Map<string, string>());
  const sentTextOf = useCallback((message: ChatMessage) => sentTextRef.current.get(message.id) ?? message.content, []);
  // This panel's identity on the conversation's event stream: the backend
  // never relays to it the turns it started itself.
  const [clientId, setClientId] = useState(() => randomId());
  // The panel's own turn whose stream dropped, now awaited from the event stream.
  const handoverTimerRef = useRef<number | null>(null);
  const handoverTurnIdRef = useRef<string | null>(null);
  const clearHandover = () => {
    if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
    handoverTimerRef.current = null;
    handoverTurnIdRef.current = null;
  };
  // A stopped relayed turn whose frames name no turn: skipped until it ends
  // ('skipping'), then its stored end too, should one follow ('ended').
  const skipUnnamedTurnRef = useRef<'off' | 'skipping' | 'ended'>('off');
  const getRequestExtrasRef = useRef(getRequestExtras);
  getRequestExtrasRef.current = getRequestExtras;
  const onStreamEventRef = useRef(onStreamEvent);
  onStreamEventRef.current = onStreamEvent;
  const onConversationTitleRef = useRef(onConversationTitle);
  onConversationTitleRef.current = onConversationTitle;
  const onBeforeSendRef = useRef(onBeforeSend);
  onBeforeSendRef.current = onBeforeSend;
  const onHeldSendSettledRef = useRef(onHeldSendSettled);
  onHeldSendSettledRef.current = onHeldSendSettled;
  // Ref mirror of conversationId — always current across async boundaries
  const conversationIdRef = useRef(conversationId);
  // Ref mirror of isLoading, so the recovery probe can tell at apply time
  // whether a live turn has started owning the prompt since it was issued.
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  // Ref mirror of pageContext so the value sent reflects the page the user is
  // on at send time, regardless of when the send handler closure was created.
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;
  // The elements of the last host-page snapshot, by the reference the next
  // `act_on_page` action names them with (#5559).
  const pageRefsRef = useRef<Map<string, Element>>(new Map());
  const onRelativeLinkClickRef = useRef(onRelativeLinkClick);
  onRelativeLinkClickRef.current = onRelativeLinkClick;
  // A page action answers from the closure of the render that began the turn,
  // so a header rotated since would go out stale and 401 the answer.
  const requestHeadersRef = useRef(requestHeaders);
  requestHeadersRef.current = requestHeaders;
  // Conversation id as the paused turn itself reported it. The decision POST
  // needs an id, and the first turn of a fresh conversation has none yet —
  // `conversationId` is normally learned from `done`, which a paused turn has
  // by definition not reached. Kept separate from `conversationIdRef` rather
  // than adopted into it: a pause should not quietly switch on the affordances
  // (steering, history) that having an id unlocks.
  const approvalConversationIdRef = useRef<string | null>(null);
  // True when the pending prompt was recovered from the server rather than read
  // off a live stream — the turn is running, but nothing is listening to it.
  const approvalDetachedRef = useRef(false);
  // Conversations already asked about a pause, so the recovery probe runs once
  // per conversation instead of on every render that settles.
  const probedConversationRef = useRef<string | null>(null);
  // When the resume watch stops regardless of what the turn reports.
  const resumeDeadlineRef = useRef(0);
  // One session creation at a time, for the chat on screen: a new chat
  // abandons the one in flight (see `createSessionGate`).
  const [sessionGate] = useState(createSessionGate);
  // The workspace the next session is created in ("new conversation" inside
  // a workspace group). A ref for the request, state for the list to show it.
  const pendingWorkspaceRef = useRef<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  // Abort controller for in-flight file uploads (cancelled on new chat)
  const uploadAbortRef = useRef<AbortController>(new AbortController());

  // Guard invalid consumer values and keep deterministic limits.
  const effectiveMaxFileCount = Number.isFinite(maxFileCount) && maxFileCount > 0 ? Math.floor(maxFileCount) : DEFAULT_MAX_FILE_COUNT;
  const effectiveMaxTotalSize = Number.isFinite(maxTotalSize) && maxTotalSize > 0 ? maxTotalSize : DEFAULT_MAX_TOTAL_SIZE;

  // Determine message endpoint URL
  const getMessagesUrl = () => {
    if (isLegacy || apiEndpoints?.singleEndpoint) {
      return apiBaseUrl; // POST directly to base URL
    }
    return `${apiBaseUrl}${apiEndpoints?.messages ?? '/chat/messages'}`;
  };

  // A pick counts while its `@key` is in the text: editing it out drops it.
  useEffect(() => {
    setConversationRefs((prev) => pruneConversationRefs(prev, inputValue));
    setAgentMentions((prev) => pruneAgentMentions(prev, inputValue));
  }, [inputValue]);
  const addAgentMention = useCallback((mention: AgentMention) => {
    setAgentMentions((prev) => withAgentMention(prev, mention));
  }, []);

  const addConversationRef = useCallback((ref: ChatConversationRef) => {
    setConversationRefs((prev) => withConversationRef(prev, ref));
  }, []);

  // Determine mid-run steering endpoint URL (null disables steering)
  const getSteerUrl = (): string | null => {
    if (isLegacy || backendType === 'ag-ui' || apiEndpoints?.singleEndpoint || apiEndpoints?.steer === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.steer ?? '/chat/messages/steer'}`;
  };

  /**
   * Determine the tool-approval endpoint URL, or null when this host has not
   * opted in.
   *
   * Unlike its siblings there is no default path — see {@link ApiEndpoints.approve}.
   * Whether this returns a URL is exactly what decides if the widget advertises
   * `supports_tool_approval`, so "configured" and "able to answer" are the same
   * fact rather than two that can drift apart.
   */
  const getApproveUrl = (): string | null => {
    if (isLegacy || backendType === 'ag-ui' || apiEndpoints?.singleEndpoint) return null;
    const path = apiEndpoints?.approve;
    if (!path) return null;
    return `${apiBaseUrl}${path}`;
  };
  // Same reason as `requestHeadersRef`: the answer must resolve the route
  // against the endpoints as they are now, not as they were at turn start.
  const getApproveUrlRef = useRef(getApproveUrl);
  getApproveUrlRef.current = getApproveUrl;

  /**
   * Determine the pause-recovery URL for one conversation, or null when the
   * host has not exposed the route. See {@link ApiEndpoints.pendingApprovals}.
   */
  const getPendingApprovalsUrl = (convId: string): string | null => {
    if (isLegacy || backendType === 'ag-ui' || apiEndpoints?.singleEndpoint) return null;
    const base = apiEndpoints?.pendingApprovals;
    if (!base) return null;
    return `${apiBaseUrl}${base}/${convId}/pending-approvals`;
  };

  /**
   * Read what a conversation is paused on, and whether its turn is still going.
   *
   * One request serves three purposes: recovering a prompt the page never saw,
   * telling a resumed turn's watcher when to stop, and counting as the sign of
   * life that keeps a paused turn from being abandoned. Returns null on any
   * failure — every caller treats that as "learned nothing" and tries again or
   * leaves the panel as it was.
   */
  const readPendingApprovals = async (convId: string): Promise<{ proposals?: ToolApprovalProposal[]; turnRunning: boolean } | null> => {
    const url = getPendingApprovalsUrl(convId);
    if (!url) return null;
    try {
      const res = await fetch(url, { headers: { ...(requestHeaders ?? {}) } });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        proposals: parseToolApprovalProposals(data?.proposals),
        // Anything but an explicit `running` ends the watch. A backend that
        // omits the field is one that cannot say, and waiting forever on a
        // turn nobody can report on is the worse failure.
        turnRunning: data?.turn === 'running',
      };
    } catch {
      return null;
    }
  };

  /**
   * Ask the panel to re-read the conversation from the server.
   *
   * Clearing the guard alone would not do it — the restore effect lives in the
   * panel and only re-runs when something in its dependencies changes, which is
   * what the nonce is for.
   */
  const reloadHistory = useCallback(() => {
    historyLoadedRef.current = false;
    setHistoryReloadNonce((n) => n + 1);
  }, []);

  // Determine upload endpoint URL (null disables file upload proxying)
  const getUploadUrl = (): string | null => {
    if (isLegacy || apiEndpoints?.singleEndpoint || apiEndpoints?.upload === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.upload ?? '/chat/upload'}`;
  };

  /** A REST-only route the host opted into (no default), resolved against the base. */
  const optInUrl = (path: string | null | undefined): string | null => {
    if (isLegacy || backendType === 'ag-ui' || apiEndpoints?.singleEndpoint || !path) return null;
    return `${apiBaseUrl}${path}`;
  };
  const getCancelUrl = () => optInUrl(apiEndpoints?.cancel);
  const getSkipWaitUrl = () => optInUrl(apiEndpoints?.skipWait);
  const getEventsUrl = (convId: string): string | null => {
    const base = optInUrl(apiEndpoints?.events);
    return base ? `${base}/${encodeURIComponent(convId)}/events?client_id=${encodeURIComponent(clientId)}` : null;
  };
  const hasEvents = !!optInUrl(apiEndpoints?.events);
  /** Names this panel to a backend that relays turns, so its own are not relayed back. */
  const clientIdHeader = (): Record<string, string> => (hasEvents ? { 'X-Chat-Client-Id': clientId } : {});

  // Determine sessions endpoint URL
  const getSessionsUrl = (): string | null => {
    if (isLegacy || apiEndpoints?.singleEndpoint || apiEndpoints?.sessions === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.sessions ?? '/chat/sessions'}`;
  };

  /**
   * Update conversationId in React state, the ref mirror, and localStorage.
   * Stable identity (useCallback) so it can be used as an effect dependency.
   */
  const onConversationIdChangeRef = useRef(onConversationIdChange);
  onConversationIdChangeRef.current = onConversationIdChange;
  const updateConversationId = useCallback(
    (id: string | null, { notify = true }: { notify?: boolean } = {}) => {
      const changed = conversationIdRef.current !== id;
      conversationIdRef.current = id;
      setConversationId(id);
      if (!isControlled) writeStorage('local', conversationStorageKey, id);
      if (changed && notify) onConversationIdChangeRef.current?.(id);
    },
    [isControlled, conversationStorageKey],
  );

  /**
   * Ensure a conversation exists. Concurrent callers of the same chat (e.g.
   * multiple files selected at once) share a single session creation, and a
   * creation answered after a new chat was started resolves to `null` without
   * touching the chat that replaced it.
   */
  const ensureConversation = async (slug: string | null | undefined): Promise<string | null> => {
    // Fast path: already have one
    if (conversationIdRef.current) return conversationIdRef.current;

    // If another call is already creating, wait for it
    if (sessionGate.pending) return sessionGate.pending;

    const sessionsUrl = getSessionsUrl();
    if (!sessionsUrl) return null;

    return sessionGate.run(async (isCurrent, signal) => {
      const workspaceId = pendingWorkspaceRef.current;
      const res = await fetch(sessionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
        body: JSON.stringify(workspaceId ? { agent_slug: slug, workspace_id: workspaceId } : { agent_slug: slug }),
        signal,
      });
      if (!res.ok || !isCurrent()) return null;
      const data = await res.json();
      // The user started another chat meanwhile: this conversation is not
      // its, and neither is the workspace or the history guard to reset.
      if (!isCurrent()) return null;
      const convId = (data?.conversation_id as string) ?? null;
      if (convId) {
        // Just created: there is no history to restore. Left armed, the
        // panel's restore would fetch it while the first turn streams and
        // replace the answer being written with the one message persisted.
        historyLoadedRef.current = true;
        updateConversationId(convId);
        pendingWorkspaceRef.current = null;
        setPendingWorkspaceId(null);
      }
      return convId;
    });
  };

  /**
   * Upload a single file to the backend and return its file_id.
   */
  const uploadSingleFile = async (file: File, convId: string, signal: AbortSignal): Promise<string> => {
    const uploadUrl = getUploadUrl()!;
    const formData = new FormData();
    formData.append('conversation_id', convId);
    formData.append('file', file, file.name);

    const uploadHeaders = requestHeaders
      ? Object.fromEntries(
          Object.entries(requestHeaders).filter(([k]) => {
            const key = k.toLowerCase();
            return key !== 'content-type';
          }),
        )
      : undefined;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
      signal,
    });
    if (!res.ok) {
      throw new Error(`File upload failed: ${res.status}`);
    }
    const data = await res.json();
    const ids: string[] = data.file_ids ?? [];
    if (ids.length === 0) throw new Error('No file_id returned');
    return ids[0];
  };

  /**
   * Handle file selection: validate limits, add files to state immediately,
   * then upload them in the background. Each file chip shows its upload status.
   */
  const handleFileAdd = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !getUploadUrl()) return;

    // Build the list of accepted files outside the state updater (pure logic)
    const incoming = Array.from(fileList);

    // We need current state to check limits — use a ref-like approach:
    // read attachedFiles via a one-shot updater that returns prev unchanged,
    // then compute outside. Simpler: just compute optimistically and let the
    // updater do the final gating.

    // Pre-generate stable IDs and entries so side effects use the same IDs
    const candidates: { file: File; tempId: string }[] = incoming.map((file) => ({
      file,
      tempId: crypto.randomUUID(),
    }));

    // Update state (pure — no side effects)
    let accepted: { file: File; tempId: string }[] = [];
    setAttachedFiles((prev) => {
      const currentCount = prev.length;
      const currentSize = prev.reduce((sum, f) => sum + f.size, 0);

      const slotsAvailable = effectiveMaxFileCount - currentCount;
      if (slotsAvailable <= 0) return prev;

      let sizeLeft = effectiveMaxTotalSize - currentSize;
      const filtered: { file: File; tempId: string }[] = [];
      for (const c of candidates.slice(0, slotsAvailable)) {
        if (c.file.size <= sizeLeft) {
          filtered.push(c);
          sizeLeft -= c.file.size;
        }
      }
      if (filtered.length === 0) return prev;

      accepted = filtered;

      const newEntries: ChatFile[] = filtered.map(({ file, tempId }) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        rawFile: file,
        uploadStatus: 'pending' as const,
        fileId: tempId,
      }));

      return [...prev, ...newEntries];
    });

    // Launch uploads OUTSIDE the state updater (side effects)
    // Use setTimeout(0) to ensure state has settled after the updater
    setTimeout(() => {
      const signal = uploadAbortRef.current.signal;
      for (const { file, tempId } of accepted) {
        (async () => {
          try {
            const convId = await ensureConversation(agentSlug);
            if (!convId) {
              setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, uploadStatus: 'error' } : f)));
              return;
            }
            const fileId = await uploadSingleFile(file, convId, signal);
            setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, fileId, uploadStatus: 'done' } : f)));
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, uploadStatus: 'error' } : f)));
          }
        })();
      }
    }, 0);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const { files } = e.clipboardData;
    if (files.length > 0) {
      e.preventDefault();
      handleFileAdd(files);
    }
  };

  /**
   * Mid-run steering: dispatch a message while the agent is still generating.
   * The user bubble is added optimistically and the steer endpoint is POSTed;
   * the backend persists the message and injects it into the running agentic
   * loop at the next iteration boundary. On failure (network error, or a
   * backend without steering support answering non-2xx) the optimistic bubble
   * is rolled back and the text is restored into the composer — prepended on
   * its own line if the user already typed something new — so the message is
   * never silently lost and never resets the in-flight run state.
   */
  const steerMessage = async (
    content: string,
    files: ChatFile[] = [],
    restoreToComposer = true,
    shown = content,
  ): Promise<{ result: 'ok'; turnId: string | null } | { result: 'ended' | 'failed' }> => {
    const steerUrl = getSteerUrl();
    const convId = conversationIdRef.current;
    if (!steerUrl || !convId) return { result: 'failed' };

    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: shown,
      timestamp: new Date(),
      files: files.length > 0 ? files : undefined,
    };
    if (shown !== content) sentTextRef.current.set(optimistic.id, content);
    setMessages((prev) => [...prev, optimistic]);
    const fileIds = files.filter((f) => f.uploadStatus === 'done' && f.fileId).map((f) => f.fileId!);

    try {
      const res = await fetch(steerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify({ conversation_id: convId, content, agent_slug: agentSlug, ...(fileIds.length > 0 ? { file_ids: fileIds } : {}) }),
      });
      if (res.ok) {
        // The turn the backend handed it to, when it says.
        const data: unknown = await res.json().catch(() => null);
        const turnId = data && typeof data === 'object' ? (data as { turn_id?: unknown }).turn_id : null;
        return { result: 'ok', turnId: typeof turnId === 'string' && turnId ? turnId : null };
      }
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      // Nothing running any more: the turn ended while this was on its way.
      if (res.status === 409 && holdSends) return { result: 'ended' };
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    // A message the user typed goes back where it came from; one the host sent does not land in the composer.
    if (restoreToComposer) {
      setInputValue((prev) => (prev ? `${shown}\n${prev}` : shown));
      if (files.length > 0) setAttachedFiles((prev) => [...files, ...prev]);
    }
    return { result: 'failed' };
  };

  /**
   * Answer a turn that paused on a gated tool call.
   *
   * The decision travels the same way a steering message does — a POST beside
   * the open stream — and for the same reason: the turn is still running, so
   * the answer cannot ride on a new one. The paused turn is polling for it and
   * resumes on the stream that is already open, with no lost context.
   *
   * Deliberately not carried on the turn's own AbortController: the two are
   * independent requests, and aborting the turn must not look like a decision.
   *
   * A failure leaves the prompt on screen. The alternative — clearing it —
   * would strand the turn paused with nothing to answer it, which is the exact
   * state this whole opt-in exists to avoid.
   */
  const submitApprovalDecisions = async (decisions: ToolApprovalDecision[]) => {
    const approveUrl = getApproveUrl();
    const convId = approvalConversationIdRef.current ?? conversationIdRef.current;
    // Nothing decided is a no-op, not a failure — the prompt only submits a
    // full set, so this is unreachable from the UI.
    if (decisions.length === 0) return;
    // Missing prerequisites must be VISIBLE. The prompt is on screen, the turn
    // is paused behind it, and a silent return would leave the reviewer
    // clicking a control that does nothing — the exact failure this feature
    // exists to prevent, reintroduced at the last step. Reachable if the host
    // never named an approve path, or if a paused turn arrived without a
    // conversation id on the first turn of a fresh conversation, where the id
    // is otherwise only learned from `done`.
    if (!approveUrl || !convId) {
      setApprovalError(t('This decision could not be sent. Reload the chat and try again.'));
      return;
    }

    setApprovalError(null);
    setIsSubmittingApproval(true);
    try {
      const res = await fetch(approveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify({
          conversation_id: convId,
          decisions: decisions.map((d) => ({
            tool_call_id: d.toolCallId,
            decision: d.verdict,
            // Only ever sent with a rejection, and only when the reviewer
            // actually wrote something — an empty string reaches the agent as
            // a reason that says nothing.
            ...(d.verdict === 'reject' && d.rejectionReason ? { rejection_reason: d.rejectionReason } : {}),
          })),
        }),
      });
      if (res.ok) {
        setPendingApprovals(null);
        if (approvalDetachedRef.current && !relayedTurnRef.current) {
          // Answered after a reload: the turn resumes, but the stream it would
          // have reported on died with the old page. The backend persists the
          // answer and suppresses the live `done`, so re-reading the
          // conversation is the only way it can ever appear — and without this
          // the click would look like it did nothing at all.
          approvalDetachedRef.current = false;
          resumeDeadlineRef.current = Date.now() + RESUME_WATCH_MS;
          setIsResumingAfterDecision(true);
          return;
        }
        // The turn is moving again; show that immediately rather than leaving
        // the composer looking idle until the next server event lands.
        setAgentStatus((prev) => (prev ? { ...prev, status: 'thinking' } : { status: 'thinking' }));
        return;
      }
      // 409: nothing is waiting any more — the turn finished, was cancelled, or
      // somebody else answered it. Distinguished from a transient failure
      // because retrying cannot help; the stream ending clears the prompt.
      setApprovalError(
        res.status === 409 ? t('This turn is no longer waiting for a decision.') : t('Could not send your decision. Please try again.'),
      );
    } catch {
      setApprovalError(t('Could not send your decision. Please try again.'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  /**
   * Perform one `act_on_page` action on the host page and answer it with a
   * fresh snapshot (#5559). The answer goes to the approve path, which the host
   * proxies already forward; the turn waits for it on the open stream.
   *
   * A 409 means the turn no longer waits for this action (it timed out or
   * ended): nothing to retry, so it is dropped.
   */
  const answerPageAction = async (actionId: string, action: PageAction, conversationIdHint?: string) => {
    const approveUrl = getApproveUrlRef.current();
    const convId = conversationIdHint ?? conversationIdRef.current;
    if (!approveUrl || !convId || typeof document === 'undefined') return;
    // The turn's own signal: Stop, New chat and switching conversation abort it,
    // and this runs detached from the stream, so without it a stopped turn would
    // still click the page and then answer for a conversation that is gone.
    const signal = pageActionControllerRef.current?.signal;
    // The stream outlives a closed panel, so the turn is still waiting: it is
    // answered without the page and without the aborted signal, which would
    // cancel the request too and leave it waiting out its timeout per step.
    const refuse = async (error: string) => {
      try {
        await fetch(approveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}) },
          body: JSON.stringify({
            conversation_id: convId,
            page_action: { action_id: actionId, ok: false, error, url: '', title: '', snapshot: '' },
          }),
        });
      } catch {
        // The turn's own page wait ends it; there is nothing to show here.
      }
    };
    if (signal?.aborted) return refuse('panel_closed');
    // The same opt-in that decides whether the capability is advertised, tested
    // again on the way in: an unsolicited frame must not read or act on the page
    // of a host that never offered it. Answered, so the turn does not hang.
    if (!hostTakesPageActions(approveUrl, onRelativeLinkClickRef.current)) {
      return refuse('page_actions_not_supported');
    }
    setAgentStatus((prev) => (prev ? { ...prev, status: 'acting_on_page' } : { status: 'acting_on_page' }));
    try {
      const result = await performPageAction(action, pageRefsRef.current, onRelativeLinkClickRef.current, document, signal);
      if (signal?.aborted) return refuse('panel_closed');
      if (action.type !== 'snapshot') await waitForDomSettle(document, { signal });
      if (signal?.aborted) return refuse('panel_closed');
      // The snapshot can throw on its own (a very deep DOM, a host
      // `getComputedStyle` that raises). It rides in `error` while `ok` stays
      // the action's own result: `ok: false` would have the agent retry a click
      // that already ran, and a field of its own would be dropped unseen by a
      // backend that does not know it, leaving an empty page and no sign why.
      let page = { text: '', url: '', title: '' };
      let snapshotError: string | null = null;
      try {
        const snapshot = takePageSnapshot(document);
        pageRefsRef.current = snapshot.refs;
        page = { text: snapshot.text, url: snapshot.url, title: snapshot.title };
      } catch (err) {
        pageRefsRef.current = new Map();
        snapshotError = `${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
      }
      await fetch(approveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}) },
        signal,
        body: JSON.stringify({
          conversation_id: convId,
          page_action: {
            action_id: actionId,
            ok: result.ok,
            error: result.error ?? (snapshotError === null ? null : `snapshot_failed: ${snapshotError}`),
            url: page.url,
            title: page.title,
            snapshot: page.text,
          },
        }),
      });
    } catch {
      // The turn's own page wait ends it; there is nothing to show here.
    } finally {
      // Not for a turn that was stopped: its replacement owns the status line.
      if (!signal?.aborted) {
        setAgentStatus((prev) => (prev?.status === 'acting_on_page' ? { ...prev, status: 'thinking' } : prev));
      }
    }
  };

  /**
   * Render one turn's frames into the transcript: the turn this panel started,
   * read off its message stream, or one of another origin (a second tab, a
   * reload) relayed by the conversation's event stream. A segment closed by an
   * intermediate `done` is followed by a fresh assistant bubble.
   */
  const createTurnRenderer = (firstAssistantId: string, relayed: boolean) => {
    let currentAssistantId = firstAssistantId;
    // Every bubble the turn opened: a steered turn answers in several.
    const segmentIds = [firstAssistantId];
    let accumulated = '';
    let doneReceived = false;
    // An error, a stop or the session's end the stream reported: what it wrote must not be put back over it.
    let ended: 'error' | 'cancelled' | 'session' | null = null;
    const ctx: ProtocolContext = { hasUsedTools: false, activeNodeId: '' };

    const deltas = createStreamDeltas((textChanged, thinking) => {
      if (textChanged) {
        // Snapshot the segment id and text: the state updater runs
        // asynchronously and `currentAssistantId` / `accumulated` may
        // already belong to the NEXT segment by then.
        const segId = currentAssistantId;
        const text = accumulated;
        setAgentStatus((prev) => ({ status: 'streaming', thinkingContent: prev?.thinkingContent }));
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text } : m)));
      }
      if (thinking) {
        setAgentStatus((prev) => ({
          ...prev,
          status: prev?.status ?? 'thinking',
          thinkingContent: (prev?.thinkingContent ?? '') + thinking,
        }));
      }
    });

    // Events after a `done` open a new segment: a steered turn answers the
    // steering message in a follow-up pass on the same stream, and each
    // segment carries its own reasoning.
    const ensureSegment = () => {
      if (!doneReceived) return;
      // Nothing of the closed segment may land in the new one.
      deltas.flush();
      doneReceived = false;
      accumulated = '';
      currentAssistantId = crypto.randomUUID();
      segmentIds.push(currentAssistantId);
      const segmentId = currentAssistantId;
      setMessages((prev) => [...prev, { id: segmentId, role: 'assistant', content: '', timestamp: new Date() }]);
      setAgentStatus({ status: 'thinking' });
    };

    const applyStatus = (parsed: Extract<ParsedAction, { action: 'status' }>) => {
      ensureSegment();
      const segId = currentAssistantId;
      // Orthogonal to the status label below: a progress frame can carry a
      // fresh context reading whatever phase it announces.
      if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
      if (parsed.status === 'thinking_text') {
        deltas.thinking(parsed.thinkingContent ?? '');
        return;
      }
      // Every other status lands after the text and reasoning that arrived
      // before it.
      deltas.flush();
      const elapsedStartMs = typeof parsed.elapsedS === 'number' ? Date.now() - parsed.elapsedS * 1000 : undefined;
      if (parsed.resumed) {
        // A re-attached turn is replayed from its start: what it had written
        // so far arrives again, whole.
        accumulated = '';
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: '' } : m)));
        setAgentStatus({ status: 'thinking', elapsedS: parsed.elapsedS, elapsedStartMs });
      } else if (parsed.status === 'stream_retract') {
        // Rare: text that streamed as a provisional answer turned out to
        // precede tool calls — discard the answer bubble (the text re-arrives
        // as thinking_text right after, so it lands in the reasoning window).
        accumulated = '';
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: '' } : m)));
        setAgentStatus((prev) => ({ status: 'analyzing', thinkingContent: prev?.thinkingContent }));
      } else if (parsed.status === 'tool_heartbeat') {
        // Liveness signal during a long tool execution: update the elapsed
        // counter but KEEP the current status label/tools, re-anchoring the
        // local 1s ticker in ChatThinking on the server clock.
        setAgentStatus((prev) =>
          prev
            ? { ...prev, elapsedS: parsed.elapsedS, elapsedStartMs }
            : { status: 'tool_start', tools: parsed.tools, elapsedS: parsed.elapsedS, elapsedStartMs },
        );
      } else if (parsed.status === 'wait_start') {
        setAgentStatus((prev) => ({
          status: 'wait_start',
          thinkingContent: prev?.thinkingContent,
          waitSeconds: parsed.waitSeconds,
          waitReason: parsed.waitReason,
          waitStartMs: Date.now(),
        }));
      } else {
        setAgentStatus((prev) => ({ status: parsed.status, tools: parsed.tools, thinkingContent: prev?.thinkingContent }));
      }
    };

    const applyDone = (parsed: Extract<ParsedAction, { action: 'done' }>) => {
      deltas.flush();
      doneReceived = true;
      // A completed segment cannot still be waiting on a decision, so any
      // prompt left standing (a submission that failed against a turn somebody
      // else already answered) is stale.
      setPendingApprovals(null);
      setApprovalError(null);
      if (parsed.conversationId && !relayed) updateConversationId(parsed.conversationId);
      // Closing reading wins: a turn whose last iteration compacted ends lower
      // than it peaked mid-run.
      if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
      if (parsed.transferAgentId && parsed.transferAgentName) {
        setTransferredAgent({ id: parsed.transferAgentId, name: parsed.transferAgentName });
      }
      const segId = currentAssistantId;
      const finalContent = parsed.content || accumulated;
      // The backend stores a segment when its `done` is sent, and a restore
      // shows that time: stamping the send time instead would change the
      // footer on the next reload.
      const completedAt = new Date();
      setMessages((prev) => {
        // A relayed answer the transcript already holds (restored meanwhile)
        // is not shown twice.
        if (parsed.messageId && prev.some((m) => m.id !== segId && m.serverId === parsed.messageId)) {
          return prev.filter((m) => m.id !== segId);
        }
        return prev.map((m) =>
          m.id === segId
            ? {
                ...m,
                content: finalContent,
                timestamp: completedAt,
                toolNames: parsed.toolNames,
                toolCallCount: parsed.toolCallCount,
                iterations: parsed.iterations,
                attachments: parsed.attachments,
                artifacts: parsed.artifacts,
                reasoning: parsed.reasoning,
                toolCallTrace: parsed.toolCallTrace,
                transferChain: parsed.transferChain,
                isTruncated: parsed.isTruncated,
                agentName: parsed.answeredBy?.agentName ?? m.agentName,
                answeredBy: parsed.answeredBy,
                mentionFailed: parsed.mentionFailed,
                serverId: parsed.messageId ?? m.serverId,
              }
            : m,
        );
      });
    };

    /** Apply one frame; `'end'` when it closes the turn. */
    const apply = (parsed: ParsedAction): 'continue' | 'end' => {
      switch (parsed.action) {
        case 'status':
          applyStatus(parsed);
          return 'continue';
        case 'stream':
          ensureSegment();
          accumulated += parsed.content;
          deltas.text();
          return 'continue';
        case 'done':
          applyDone(parsed);
          // The stream of a turn this panel started ends by itself; a relayed
          // turn ends on its last segment.
          return relayed && !parsed.intermediate ? 'end' : 'continue';
        case 'approval_required':
          // The turn stops here and the stream goes silent until a decision is
          // POSTed back. Not an end state: the rest of the turn arrives on this
          // same stream afterwards, so the reasoning that led to the proposed
          // call stays on screen for the reviewer to judge it by.
          deltas.flush();
          approvalConversationIdRef.current = parsed.conversationId ?? conversationIdRef.current;
          approvalDetachedRef.current = false;
          setApprovalError(null);
          setPendingApprovals(parsed.proposals);
          setAgentStatus((prev) => (prev ? { ...prev, status: 'awaiting_approval' } : { status: 'awaiting_approval' }));
          return 'continue';
        case 'error': {
          ensureSegment();
          deltas.flush();
          const segId = currentAssistantId;
          // The backend reported a failure of its own, so the generic apology
          // rather than "check the configuration": the connection plainly worked.
          ended = 'error';
          setMessages((prev) =>
            prev.map((m) => (m.id === segId ? { ...m, content: parsed.content || t('Sorry, an error occurred. Please try again.') } : m)),
          );
          return 'end';
        }
        case 'cancelled': {
          deltas.flush();
          ended = 'cancelled';
          const segId = currentAssistantId;
          setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, stopped: true } : m)));
          return 'end';
        }
        case 'session_ended': {
          // The user is signed out: what was written stays, an empty bubble goes.
          deltas.flush();
          ended = 'session';
          const segId = currentAssistantId;
          setMessages((prev) => prev.filter((m) => !(m.id === segId && !m.content)));
          return 'end';
        }
        default:
          return 'continue';
      }
    };

    return {
      ctx,
      deltas,
      apply,
      currentAssistantId: () => currentAssistantId,
      accumulated: () => accumulated,
      doneReceived: () => doneReceived,
      segmentIds: () => segmentIds,
      ended: () => ended,
    };
  };

  /** Frames about the conversation rather than a turn; true when handled. */
  const applyConversationFrame = (parsed: ParsedAction): boolean => {
    switch (parsed.action) {
      case 'user_message': {
        const relayedMessage = parsed.message;
        setMessages((prev) => {
          if (relayedMessage.serverId && prev.some((m) => m.serverId === relayedMessage.serverId)) return prev;
          // This tab's own message, echoed back: it takes the persisted id rather than a second bubble.
          // Looked for among the latest messages only: an older one with the same words is another message.
          let own = prev.length - 1;
          while (own >= 0 && !(prev[own].role === 'user' && !prev[own].serverId && sentTextOf(prev[own]) === relayedMessage.content)) own -= 1;
          if (own >= 0 && prev.length - own <= 3) return prev.map((m, i) => (i === own ? { ...m, serverId: relayedMessage.serverId } : m));
          return [...prev, relayedMessage];
        });
        return true;
      }
      case 'conversation_title':
        onConversationTitleRef.current?.(parsed.conversationId ?? conversationIdRef.current, parsed.title);
        return true;
      case 'approval_resolved':
        setPendingApprovals(null);
        setApprovalError(null);
        return true;
      default:
        return false;
    }
  };

  const handleSendMessage = async (override?: SendOverride): Promise<ChatSendOutcome> => {
    // A host-driven or held send leaves the composer, its attachments and picks alone.
    const fromComposer = !override;
    let rawText = override ? override.text : inputValue;
    const draft = fromComposer ? inputValue : '';
    const files = fromComposer ? attachedFiles : (override?.files ?? []);
    if (!rawText.trim() && files.length === 0) return 'dropped';
    // The host's say before anything leaves: it may take the send over, or reword it.
    const decided = applySendDecision(
      rawText,
      override?.decided
        ? undefined
        : askHost(onBeforeSendRef.current, {
            text: rawText,
            source: fromComposer ? 'composer' : (override?.source ?? 'host'),
            turnRunning: isLoadingRef.current,
          }),
      override?.displayText,
    );
    if (!decided) return 'dropped';
    const hookExtras = decided.extras;
    rawText = decided.text;
    const steerText = decided.text;
    // What the user's bubble shows: the host's words for it, else the text sent.
    const shownText = override?.decided ? override.displayText?.trim() || steerText : decided.displayText;
    // Kept on a held message only when it differs, so a plain one merges as before.
    const heldDisplay = shownText !== steerText ? shownText : undefined;
    // The picks the text still holds, when the host still offers the feature.
    const sentRefs = !fromComposer
      ? (override?.refs ?? [])
      : conversationReferencesUrl(apiBaseUrl, apiEndpoints, backendType)
        ? referencedConversations(conversationRefs, inputValue)
        : [];
    // The agents the text still mentions, in mention order.
    const sentMentions = !fromComposer ? (override?.mentions ?? []) : agentMentionsEnabled ? agentMentions : [];
    const mentionedIds = mentionedAgentIds(sentMentions, rawText);
    if (isLoadingRef.current) {
      if (!steerText && files.length === 0) return 'dropped';
      const clearComposer = () => {
        if (!fromComposer) return;
        setInputValue('');
        setConversationRefs([]);
        setAgentMentions([]);
        setAttachedFiles([]);
      };
      // Mid-run steering. References never steer: a steer reaches the loop as
      // text alone, and the agent would never read them. Attachments steer
      // only where the host says the steer route takes them, once uploaded.
      const uploaded = files.every((f) => f.uploadStatus === 'done');
      const canSteerThis =
        !!getSteerUrl() &&
        !!conversationIdRef.current &&
        sentRefs.length === 0 &&
        mentionedIds.length === 0 &&
        (files.length === 0 || (steerAttachments && uploaded));
      if (canSteerThis) {
        clearComposer();
        const steered = await steerMessage(steerText, files, fromComposer, shownText);
        if (steered.result === 'ended') {
          setHeldMessage((prev) =>
            mergeHeld(prev, {
              text: steerText,
              draft,
              files,
              refs: [],
              mentions: [],
              extras: hookExtras,
              displayText: heldDisplay,
              onSent: override?.onSent,
            }),
          );
          return 'held';
        }
        if (steered.result === 'ok') {
          override?.onSteered?.(steered.turnId);
          return 'steered';
        }
        return 'dropped';
      }
      // Otherwise it waits for the turn to end, where the host allows it.
      if (holdSends && uploaded) {
        clearComposer();
        setHeldMessage((prev) =>
          mergeHeld(prev, {
            text: steerText,
            draft,
            files,
            refs: sentRefs,
            mentions: sentMentions,
            extras: hookExtras,
            displayText: heldDisplay,
            onSent: override?.onSent,
          }),
        );
        return 'held';
      }
      return 'dropped';
    }
    if (!steerText && files.length === 0) return 'dropped';
    const content = steerText;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: shownText,
      timestamp: new Date(),
      files: files.length > 0 ? [...files] : undefined,
      conversationRefs: sentRefs.length > 0 ? sentRefs : undefined,
    };
    if (shownText !== content) sentTextRef.current.set(userMsg.id, content);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);
    if (fromComposer) {
      setInputValue('');
      setConversationRefs([]);
      setAgentMentions([]);
      // Clear attachment chips after sending so the input returns to a clean state.
      setAttachedFiles([]);
    }
    isLoadingRef.current = true;
    setIsLoading(true);
    setAgentStatus({ status: 'thinking' });
    // The chat this turn belongs to: a new chat (or a switch) moves the gate
    // on, and the turn's end must then leave the replacing chat's state alone.
    const turnGeneration = sessionGate.generation;

    const turn = createTurnRenderer(assistantId, false);
    streamDeltasRef.current = turn.deltas;
    liveRendererRef.current = turn;
    stopRequestedRef.current = false;
    ownTurnActiveRef.current = true;
    ownTurnIdRef.current = null;
    // Set when the turn joined is already on screen from the event stream,
    // which then carries it to its end.
    let handedOver = false;
    // The backend took the message: its stream answered.
    let accepted = false;
    // The stream said the turn is over: a last `done`, an error or a stop.
    let sawTurnEnd = false;
    /**
     * The stream is gone but the turn runs on, on the backend: the event stream,
     * under a new name for this panel, replays it. False when it cannot.
     */
    const handOver = (): boolean => {
      if (!hasEvents || !conversationIdRef.current || !ownTurnIdRef.current || turn.ended()) return false;
      handedOver = true;
      // The replay brings the whole turn back, every segment of it.
      const segments = new Set(turn.segmentIds());
      setMessages((prev) => prev.filter((m) => !segments.has(m.id)));
      handoverTurnIdRef.current = ownTurnIdRef.current;
      ownTurnIdRef.current = null;
      setClientId(randomId());
      if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
      handoverTimerRef.current = window.setTimeout(() => {
        handoverTimerRef.current = null;
        if (relayedTurnRef.current || handoverTurnIdRef.current === null) return;
        // Nothing came: the turn is over, and its answer is in the history.
        handoverTurnIdRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
        setAgentStatus(null);
        reloadHistory();
      }, HANDOVER_GRACE_MS);
      return true;
    };

    const controller = new AbortController();
    pageActionControllerRef.current?.abort();
    const pageActions = new AbortController();
    try {
      abortControllerRef.current = controller;
      pageActionControllerRef.current = pageActions;

      // Collect file_ids from already-uploaded files (uploaded eagerly on selection)
      const fileIds = (userMsg.files ?? []).filter((f) => f.uploadStatus === 'done' && f.fileId).map((f) => f.fileId!);

      // A conversation started inside a workspace is created first, filed
      // there: the message endpoint would create it in no workspace. Should
      // that fail (the workspace was archived or is no longer shared), the
      // message still goes, in a conversation of no workspace, rather than
      // being lost. So is one whose turns outlive their stream: Stop,
      // "Continue now" and steering name the conversation from the first turn.
      const turnsOutliveStream = !!(getCancelUrl() || getSkipWaitUrl() || hasEvents);
      if (!conversationIdRef.current && (pendingWorkspaceRef.current || turnsOutliveStream)) {
        const generation = sessionGate.generation;
        const created = await ensureConversation(agentSlug);
        // A new chat replaced this one meanwhile: the send went with it, and
        // the workspace now pending is the new chat's, not this send's.
        if (sessionGate.generation !== generation) return 'dropped';
        if (!created) {
          pendingWorkspaceRef.current = null;
          setPendingWorkspaceId(null);
        }
      }

      // Use conversationIdRef to get the latest value (may have been set by eager upload)
      const requestBody = buildRequestBody(backendType, content, {
        legacyChatId,
        conversationId: conversationIdRef.current,
        agentSlug,
        pageContext: pageContextRef.current,
        supportsToolApproval: getApproveUrl() !== null,
        referencedConversationIds: sentRefs.map((r) => r.conversationId),
        supportsPageActions: hostTakesPageActions(getApproveUrl(), onRelativeLinkClickRef.current),
        extras: {
          ...readRequestExtras(getRequestExtrasRef.current),
          ...(override?.extras ?? {}),
          ...(hookExtras ?? {}),
        },
      });
      if (fileIds.length > 0) {
        (requestBody as Record<string, unknown>).file_ids = fileIds;
      }
      if (mentionedIds.length > 0) {
        (requestBody as Record<string, unknown>).mentioned_agent_ids = mentionedIds;
      }

      setAgentStatus({ status: 'thinking' });

      const res = await fetch(getMessagesUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // A refusal before the stream (a rate limit, a refused option, an
        // unknown conversation) says why in its `detail`: that is what shows.
        const detail = res.ok ? null : await readRefusalDetail(res);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: detail ?? t('Unable to connect. Please check the configuration.') } : m)),
        );
        return 'failed';
      }
      accepted = true;
      override?.onSent?.();

      const parseEvent = getParser(backendType);
      await readSseEvents(res.body, (evt) => {
        try {
          askHost(onStreamEventRef.current, evt, { relayed: false });
          if (!ownTurnIdRef.current && typeof evt.turn_id === 'string' && evt.turn_id) ownTurnIdRef.current = evt.turn_id;
          const parsed = parseEvent(evt, turn.ctx);
          if (parsed.action === 'folded') {
            if (parsed.turnId && relayedTurnRef.current?.turnId === parsed.turnId) {
              handedOver = true;
              const segId = turn.currentAssistantId();
              setMessages((prev) => prev.filter((m) => m.id !== segId));
              return false;
            }
            if (parsed.turnId) ownTurnIdRef.current = parsed.turnId;
            return true;
          }
          if (applyConversationFrame(parsed)) return true;
          if (parsed.action === 'set_chat_id') {
            setLegacyChatId(parsed.chatId);
            writeStorage('local', legacyChatIdStorageKey, parsed.chatId);
            return true;
          }
          if (parsed.action === 'page_action_required') {
            turn.deltas.flush();
            // Not awaited: the stream stays silent until the answer lands,
            // and the reader must keep draining its keep-alives meanwhile.
            void answerPageAction(parsed.actionId, parsed.pageAction, parsed.conversationId);
            return true;
          }
          if (
            parsed.action === 'error' ||
            parsed.action === 'cancelled' ||
            parsed.action === 'session_ended' ||
            (parsed.action === 'done' && !parsed.intermediate)
          ) {
            sawTurnEnd = true;
          }
          return turn.apply(parsed) !== 'end';
        } catch {
          // A frame that could not be applied is skipped, not fatal.
          return true;
        }
      });
      turn.deltas.flush();
      // Ended without saying the turn is over (a proxy's idle timeout, a
      // server restart): the turn may well run on.
      if (!handedOver && !sawTurnEnd && handOver()) return 'sent';
      if (!handedOver && !turn.ended() && turn.accumulated() && !turn.doneReceived()) {
        const segId = turn.currentAssistantId();
        const text = turn.accumulated();
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text || t('No response.') } : m)));
      }
    } catch (err) {
      // A frame still pending would land after the error below, or in the
      // chat that replaced an aborted stream.
      turn.deltas.close();
      if (err instanceof DOMException && err.name === 'AbortError') return accepted ? 'sent' : 'dropped';
      const segId = turn.currentAssistantId();
      // The stream dropped mid-turn, but the backend runs the turn on.
      if (handOver()) return 'sent';
      setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: t('Sorry, an error occurred. Please try again.') } : m)));
    } finally {
      turn.deltas.close();
      if (streamDeltasRef.current === turn.deltas) streamDeltasRef.current = null;
      if (liveRendererRef.current === turn) liveRendererRef.current = null;
      ownTurnActiveRef.current = false;
      // The turn is over, so its page actions are too - but only this turn's:
      // a replacement already owns the refs by then.
      if (pageActionControllerRef.current === pageActions) pageActions.abort();
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      // An abandoned turn's chat is gone: `handleNewChat` reset the shared
      // state already, and resetting it again here would cut the Stop button,
      // the status and the approvals of a turn the new chat started since.
      // A turn handed over to the event stream is still running.
      if (sessionGate.generation === turnGeneration && !handedOver) {
        clearCancelRequest();
        isLoadingRef.current = false;
        setIsLoading(false);
        setAgentStatus(null);
        // The stream is gone, so nothing can carry a decision any more —
        // whether the turn finished, errored, or was stopped. Leaving the prompt
        // up would offer an answer to a question nobody is listening for.
        setPendingApprovals(null);
        setApprovalError(null);
        approvalConversationIdRef.current = null;
        approvalDetachedRef.current = false;
        // We watched this turn end, so there is nothing for the recovery probe to
        // find — including on a fresh conversation, whose id only just arrived.
        probedConversationRef.current = conversationIdRef.current;
      }
    }
    return accepted ? 'sent' : 'failed';
  };

  /** End the relayed turn on screen, if any, as its own stream would. */
  const endRelayedTurn = () => {
    const relayedTurn = relayedTurnRef.current;
    if (!relayedTurn) return;
    relayedTurnRef.current = null;
    relayedTurn.renderer.deltas.flush();
    relayedTurn.renderer.deltas.close();
    if (streamDeltasRef.current === relayedTurn.renderer.deltas) streamDeltasRef.current = null;
    if (liveRendererRef.current === relayedTurn.renderer) liveRendererRef.current = null;
    const segId = relayedTurn.renderer.currentAssistantId();
    setMessages((prev) => prev.filter((m) => !(m.id === segId && !m.content && !m.stopped)));
    clearCancelRequest();
    isLoadingRef.current = false;
    setIsLoading(false);
    setAgentStatus(null);
    setPendingApprovals(null);
    setApprovalError(null);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    probedConversationRef.current = conversationIdRef.current;
  };

  const endRelayedTurnRef = useRef(endRelayedTurn);
  endRelayedTurnRef.current = endRelayedTurn;

  /** Take the relayed turn on screen off it whole: the event stream, reopened, replays it from its start. */
  const withdrawRelayedTurn = () => {
    const relayedTurn = relayedTurnRef.current;
    if (!relayedTurn) return;
    const segments = new Set(relayedTurn.renderer.segmentIds());
    endRelayedTurn();
    setMessages((prev) => prev.filter((m) => !segments.has(m.id)));
  };
  const withdrawRelayedTurnRef = useRef(withdrawRelayedTurn);
  withdrawRelayedTurnRef.current = withdrawRelayedTurn;

  /** One frame of the conversation's event stream. */
  const handleEventFrame = (evt: Record<string, unknown>) => {
    askHost(onStreamEventRef.current, evt, { relayed: true });
    const relayedTurn = relayedTurnRef.current;
    const parsed = parseRestEvent(evt, relayedTurn?.renderer.ctx ?? { hasUsedTools: false, activeNodeId: '' });
    if (applyConversationFrame(parsed)) return;
    if (parsed.action === 'session_ended') {
      // Signed out: no turn of another origin goes on for this user, and a
      // handed-over turn of our own will not be replayed.
      endRelayedTurn();
      if (handoverTurnIdRef.current !== null && !ownTurnActiveRef.current) {
        clearHandover();
        isLoadingRef.current = false;
        setIsLoading(false);
        setAgentStatus(null);
      }
      return;
    }
    if (!TURN_ACTIONS.has(parsed.action)) return;
    // The turn this panel streams itself is never rendered twice.
    const turnId = typeof evt.turn_id === 'string' && evt.turn_id ? evt.turn_id : null;
    if (ownTurnActiveRef.current || (turnId && turnId === ownTurnIdRef.current)) return;
    if (turnId && turnId === stoppedTurnIdRef.current) return;
    const skip = skipUnnamedTurnRef.current;
    // A fresh acknowledgement is a new turn: the stopped one ended unseen.
    if (skip !== 'off' && evt.type === 'thinking' && evt.resumed !== true && evt.intermediate !== true) skipUnnamedTurnRef.current = 'off';
    else if (!turnId && skip !== 'off' && !relayedTurn) {
      const finalDone = parsed.action === 'done' && !parsed.intermediate;
      if (skip === 'skipping') {
        if (finalDone) skipUnnamedTurnRef.current = 'off';
        else if (parsed.action === 'cancelled' || parsed.action === 'error') skipUnnamedTurnRef.current = 'ended';
        return;
      }
      // The stopped turn's stored end, after the provisional one, is skipped too.
      skipUnnamedTurnRef.current = 'off';
      if (finalDone) return;
    }
    let current = relayedTurn;
    if (current && turnId && current.turnId && current.turnId !== turnId) {
      endRelayedTurn();
      current = null;
    }
    if (!current) {
      // The end of a turn never seen begins nothing.
      if (parsed.action === 'cancelled' || parsed.action === 'error') return;
      const bubbleId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: bubbleId, role: 'assistant', content: '', timestamp: new Date() }]);
      current = { turnId, renderer: createTurnRenderer(bubbleId, true) };
      relayedTurnRef.current = current;
      streamDeltasRef.current = current.renderer.deltas;
      liveRendererRef.current = current.renderer;
      clearHandover();
      skipUnnamedTurnRef.current = 'off';
      stopRequestedRef.current = false;
      isLoadingRef.current = true;
      setIsLoading(true);
      setAgentStatus({ status: 'thinking' });
    }
    if (current.renderer.apply(parsed) === 'end') endRelayedTurn();
  };
  const handleEventFrameRef = useRef(handleEventFrame);
  handleEventFrameRef.current = handleEventFrame;

  const handleNewChat = (workspaceId?: string) => resetChat(workspaceId, true);

  /** The new-chat reset; *notify*: the host hears of the empty conversation (not on a switch, which names the next one). */
  const resetChat = (workspaceId: string | undefined, notify: boolean) => {
    // A string only: the header and the sidebar pass this as a click handler,
    // and the click event must never reach the session request.
    const workspace = typeof workspaceId === 'string' && workspaceId ? workspaceId : null;
    pendingWorkspaceRef.current = workspace;
    setPendingWorkspaceId(workspace);
    // Nothing of the abandoned stream may land in the fresh chat.
    streamDeltasRef.current?.close();
    streamDeltasRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pageActionControllerRef.current?.abort();
    pageActionControllerRef.current = null;
    // Cancel any in-flight file uploads
    uploadAbortRef.current.abort();
    uploadAbortRef.current = new AbortController();
    // A session still being created was the abandoned chat's.
    sessionGate.abandon();
    relayedTurnRef.current?.renderer.deltas.close();
    relayedTurnRef.current = null;
    ownTurnActiveRef.current = false;
    if (heldMessageRef.current) onHeldSendSettledRef.current?.(heldMessageRef.current.text, 'cancelled');
    setHeldMessage(null);
    clearCancelRequest();
    clearHandover();
    skipUnnamedTurnRef.current = 'off';
    isLoadingRef.current = false;
    setMessages([]);
    setInputValue('');
    setConversationRefs([]);
    setAgentMentions([]);
    setAttachedFiles([]);
    setIsLoading(false);
    setAgentStatus(null);
    setTransferredAgent(null);
    // A fresh (or newly selected) conversation starts with no known occupancy;
    // the restore or the first turn fills it back in. Carrying the previous
    // conversation's reading over would be a plain lie.
    setContextUsage(null);
    setPendingApprovals(null);
    setApprovalError(null);
    setIsResumingAfterDecision(false);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    // Re-arm the probe: the conversation being switched to may well be paused.
    probedConversationRef.current = null;
    historyLoadedRef.current = false;
    if (isLegacy) {
      setLegacyChatId(null);
      writeStorage('local', legacyChatIdStorageKey, null);
    } else {
      updateConversationId(null, { notify });
    }
  };

  const clearPendingWorkspace = (workspaceId: string) => {
    if (pendingWorkspaceRef.current !== workspaceId) return;
    pendingWorkspaceRef.current = null;
    setPendingWorkspaceId(null);
  };

  const handleSwitchConversation = (id: string) => {
    if (!isLegacy && id === conversationIdRef.current) return;
    // Reuse the full new-chat reset (abort in-flight request + uploads,
    // clear transcript/composer/status), then adopt the selected id and
    // re-arm the history-restore effect so the host panel fetches the
    // conversation's messages via the sessions endpoint. The host hears of
    // the conversation switched to alone, never of an empty one between.
    resetChat(undefined, false);
    if (!isLegacy) {
      updateConversationId(id);
      // `handleNewChat` blanked the composer; bring back this conversation's
      // own unsent draft, if any, with its references.
      const draft = loadDraftState(storageKeyPrefix, id);
      setInputValue(draft.text);
      setConversationRefs(draft.refs);
    }
  };

  const clearCancelRequest = () => {
    if (cancelTimerRef.current !== null) window.clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
  };

  /**
   * Let go of the turn on screen without the backend's word that it ended.
   * *running*: a turn was on screen, whose answer then says it was stopped.
   */
  const stopLocally = (running = true) => {
    clearCancelRequest();
    const live = liveRendererRef.current;
    liveRendererRef.current = null;
    const relayedTurn = relayedTurnRef.current;
    const stoppedTurnId = relayedTurn?.turnId ?? handoverTurnIdRef.current;
    if (stoppedTurnId) stoppedTurnIdRef.current = stoppedTurnId;
    else if (relayedTurn) skipUnnamedTurnRef.current = 'skipping';
    clearHandover();
    // The text that arrived before the stop stays on screen, including what the
    // next frame would have applied; nothing after it does.
    streamDeltasRef.current?.flush();
    streamDeltasRef.current?.close();
    streamDeltasRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pageActionControllerRef.current?.abort();
    pageActionControllerRef.current = null;
    relayedTurnRef.current = null;
    isLoadingRef.current = false;
    setIsLoading(false);
    setAgentStatus(null);
    // Stopping IS the way out of a pause the reviewer does not want to answer:
    // the backend waits indefinitely by design, so abandoning the stream is
    // the client's only other move.
    setPendingApprovals(null);
    setApprovalError(null);
    setIsResumingAfterDecision(false);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    pageRefsRef.current = new Map();
    // The answer being written says it was stopped, whatever it got to; an
    // earlier empty one (before a steer) goes.
    const segId = running ? live?.currentAssistantId() : undefined;
    setMessages((prev) =>
      prev.map((m) => (m.id === segId ? { ...m, stopped: true } : m)).filter((m) => !(m.role === 'assistant' && !m.content && !m.stopped)),
    );
  };

  /**
   * Stop the turn. A backend whose turns outlive their stream (`cancel` route)
   * is asked to stop it and ends the stream with `cancelled`; without that
   * route, or should it not answer, the panel lets go of the stream itself.
   */
  const handleStopGenerating = () => {
    if (!isLoadingRef.current) {
      stopLocally(false);
      return;
    }
    stopRequestedRef.current = true;
    const cancelUrl = getCancelUrl();
    const convId = conversationIdRef.current;
    // A turn awaited from the event stream has no stream of its own to end with
    // `cancelled`: the backend is told, and the panel lets go at once.
    const awaitingHandover = handoverTurnIdRef.current !== null && !relayedTurnRef.current;
    if (!cancelUrl || !convId || awaitingHandover) {
      if (cancelUrl && convId) {
        void fetch(cancelUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
          body: JSON.stringify({ conversation_id: convId }),
        }).catch(() => undefined);
      }
      stopLocally();
      return;
    }
    if (cancelTimerRef.current !== null) return;
    setPendingApprovals(null);
    setApprovalError(null);
    setAgentStatus((prev) => ({ ...prev, status: 'cancelling' }));
    cancelTimerRef.current = window.setTimeout(() => stopLocally(), CANCEL_GRACE_MS);
    fetch(cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
      body: JSON.stringify({ conversation_id: convId }),
    })
      .then((res) => {
        if (!res.ok) stopLocally();
      })
      .catch(() => stopLocally());
  };

  const skipWaitUrl = getSkipWaitUrl();
  const skipWait = async () => {
    const url = getSkipWaitUrl();
    const convId = conversationIdRef.current;
    if (!url || !convId) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
        body: JSON.stringify({ conversation_id: convId }),
      });
      if (res.ok) setAgentStatus((prev) => (prev?.status === 'wait_start' ? { status: 'thinking', thinkingContent: prev.thinkingContent } : prev));
    } catch {
      // The wait ends on its own; the button stays for another try.
    }
  };

  /**
   * Follow the conversation's event stream (`events` route): turns started
   * elsewhere (another tab, a reload mid-turn, a second device), user
   * messages sent there, new titles and approvals answered there. Reconnects
   * with backoff while the page is visible; a route refused outright stops it.
   * Closed once the page has been hidden for {@link EVENTS_HIDDEN_CLOSE_MS};
   * shown again, the stream reopens (its snapshot replays a turn still
   * running) and the conversation is read back for what ended meanwhile.
   * A refusal of the credentials (401, 403) is tried once more each time the
   * host's `requestHeaders` change, so a refreshed token picks the stream up.
   */
  const eventsUrl = conversationId && historySettledFor === conversationId ? getEventsUrl(conversationId) : null;
  const headersKey = requestHeadersKey(requestHeaders);
  const headersKeyRef = useRef(headersKey);
  headersKeyRef.current = headersKey;
  // The stream refused for its credentials: its URL and the headers it was refused with.
  const [eventsRefused, setEventsRefused] = useState<{ url: string; headersKey: string } | null>(null);
  const [eventsReopen, setEventsReopen] = useState(0);
  useEffect(() => {
    if (!eventsRefused || eventsRefused.url !== eventsUrl || eventsRefused.headersKey === headersKey) return;
    setEventsRefused(null);
    setEventsReopen((n) => n + 1);
  }, [eventsRefused, eventsUrl, headersKey]);
  useEffect(() => {
    if (!eventsUrl) return;
    let stopped = false;
    let connected = false;
    let retry = 0;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let hiddenTimer: number | null = null;
    // Opened at least once: a stream not followed since then missed frames.
    let opened = false;
    // Frames were missed while the page was hidden: the reopened stream comes
    // with a read-back of the conversation.
    let missed = false;

    const connect = async () => {
      timer = null;
      if (stopped || connected) return;
      if (document.visibilityState === 'hidden') {
        if (opened) missed = true;
        return;
      }
      connected = true;
      controller = new AbortController();
      let refused = false;
      try {
        const sentHeadersKey = headersKeyRef.current;
        const res = await fetch(eventsUrl, {
          headers: { ...(requestHeadersRef.current ?? {}), 'X-Chat-Client-Id': clientId },
          signal: controller.signal,
        });
        if ([401, 403, 404, 405].includes(res.status)) {
          refused = true;
          if ((res.status === 401 || res.status === 403) && !stopped) setEventsRefused({ url: eventsUrl, headersKey: sentHeadersKey });
          return;
        }
        if (!res.ok || !res.body) return;
        opened = true;
        await readSseEvents(res.body, (evt) => {
          retry = 0;
          try {
            handleEventFrameRef.current(evt);
          } catch {
            // A frame that could not be applied is skipped, not fatal.
          }
        });
      } catch {
        // Dropped or aborted: reconnected below unless the effect is gone.
      } finally {
        connected = false;
        if (!stopped && !refused && !missed) {
          const delay = Math.min(EVENTS_RETRY_MAX_MS, EVENTS_RETRY_BASE_MS * 2 ** retry);
          retry += 1;
          timer = window.setTimeout(() => void connect(), delay * (0.5 + Math.random() / 2));
        }
      }
    };
    // Hidden long enough, the stream is let go of, and with it the relayed
    // turn it fed: the reopened stream replays that turn if it still runs.
    const closeWhileHidden = () => {
      hiddenTimer = null;
      if (stopped || document.visibilityState !== 'hidden') return;
      missed = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      controller?.abort();
      withdrawRelayedTurnRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimer === null) hiddenTimer = window.setTimeout(closeWhileHidden, EVENTS_HIDDEN_CLOSE_MS);
        return;
      }
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      hiddenTimer = null;
      if (document.visibilityState !== 'visible' || connected) return;
      if (timer !== null) window.clearTimeout(timer);
      retry = 0;
      if (missed) {
        missed = false;
        // What ended while the stream was closed is only in the history.
        reloadHistory();
      }
      void connect();
    };
    void connect();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // A relayed turn nothing feeds any more is over, as far as this panel can tell.
      endRelayedTurnRef.current();
    };
  }, [eventsUrl, clientId, eventsReopen, reloadHistory]);

  // The turn is over: what was held goes out as the next one.
  useEffect(() => {
    if (isLoading) return;
    if (!heldMessage) {
      // A Stop with nothing held is over with its turn: it says nothing of a later one.
      stopRequestedRef.current = false;
      return;
    }
    setHeldMessage(null);
    if (stopRequestedRef.current) {
      // Stopped: the user takes back what they typed rather than see it go; a
      // host's send is not theirs to take back.
      stopRequestedRef.current = false;
      onHeldSendSettledRef.current?.(heldMessage.text, 'returned');
      if (heldMessage.draft) setInputValue((prev) => (prev ? `${heldMessage.draft}\n${prev}` : heldMessage.draft));
      setAttachedFiles((prev) => [...heldMessage.files, ...prev]);
      setConversationRefs((prev) => [...heldMessage.refs, ...prev]);
      setAgentMentions((prev) => [...heldMessage.mentions, ...prev]);
      return;
    }
    // Told once: as the backend takes it, or as it fails or goes nowhere. Held
    // again behind a turn started meanwhile, it is told when that one ends.
    let told = false;
    const tell = (outcome: ChatHeldOutcome) => {
      if (told) return;
      told = true;
      onHeldSendSettledRef.current?.(heldMessage.text, outcome);
    };
    void handleSendMessageRef
      .current({
        ...heldMessage,
        decided: true,
        onSent: () => {
          tell('sent');
          heldMessage.onSent?.();
        },
      })
      .then(
        (outcome) => {
          if (outcome === 'held') return;
          tell(outcome === 'sent' || outcome === 'steered' ? 'sent' : outcome === 'failed' ? 'failed' : 'dropped');
        },
        () => tell('failed'),
      );
  }, [isLoading, heldMessage]);
  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  // Persist the composer draft against the conversation it belongs to. Writing
  // an empty value removes the entry, so sending (which blanks the composer)
  // also clears the draft — no explicit cleanup needed at the send sites.
  useEffect(() => {
    const id = window.setTimeout(() => {
      persistDraft(storageKeyPrefix, conversationId, inputValue, conversationRefs);
    }, DRAFT_PERSIST_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [inputValue, conversationId, conversationRefs, storageKeyPrefix]);

  // A panel closed mid-stream has no state left for the stream's frames to
  // update. Its page actions stop, so a hover fallback cannot click the host
  // page after the panel closed; the stream itself runs on, which is how its
  // answer is in history when the panel reopens.
  useEffect(
    () => () => {
      streamDeltasRef.current?.close();
      pageActionControllerRef.current?.abort();
      if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
      // A message still held goes nowhere with the panel.
      if (heldMessageRef.current) onHeldSendSettledRef.current?.(heldMessageRef.current.text, 'cancelled');
    },
    [],
  );

  // Flush the pending draft on unmount. Hosts unmount the panel the instant it
  // is closed, which would otherwise drop anything typed inside the debounce
  // window — exactly the keystrokes the draft exists to protect.
  const draftFlushRef = useRef({ conversationId, inputValue, conversationRefs });
  draftFlushRef.current = { conversationId, inputValue, conversationRefs };
  useEffect(
    () => () => {
      const { conversationId: id, inputValue: value, conversationRefs: refs } = draftFlushRef.current;
      persistDraft(storageKeyPrefix, id, value, refs);
    },
    [],
  );

  /**
   * Recover a prompt the page never saw, or lost to a reload.
   *
   * `approval_required` is one event on one stream: reload while it is showing
   * and the panel holds nothing — not even the `tool_call_id`s a decision has
   * to name — while the turn goes on waiting for an answer that can no longer
   * be given. Asked once per conversation; an empty list is the ordinary
   * answer, and the whole probe is best-effort, since a host that has not
   * exposed the route simply keeps the pre-recovery behaviour.
   *
   * Skipped while a turn is live: that prompt arrives on the stream, and the
   * stream is the more current of the two.
   */
  useEffect(() => {
    const convId = conversationId;
    if (!convId || isLoading) return;
    if (probedConversationRef.current === convId) return;
    // Recovering a prompt there is no way to answer would only strand the
    // reviewer differently, so both routes have to be configured.
    const url = getPendingApprovalsUrl(convId);
    if (!url || !getApproveUrl()) return;
    probedConversationRef.current = convId;

    (async () => {
      // Best-effort: a failure leaves the panel exactly as it was, which is the
      // pre-recovery behaviour.
      const state = await readPendingApprovals(convId);
      if (!state?.proposals) return;
      // Validate at apply time against the live refs rather than dropping the
      // response on effect teardown — the same reasoning as the panel's
      // history restore. A StrictMode double-invoke or a host re-render tears
      // this effect down while the request is in flight without the
      // conversation having changed, and a teardown flag would discard the
      // recovery in exactly the case it is needed. Only a genuinely superseded
      // response is dropped: another conversation, or a live turn that has
      // since started and will carry its own prompt.
      if (conversationIdRef.current !== convId || isLoadingRef.current) return;
      approvalConversationIdRef.current = convId;
      approvalDetachedRef.current = true;
      setApprovalError(null);
      setPendingApprovals(state.proposals);
    })();
    // Keyed on the conversation and whether a turn is live; the endpoint
    // getters read current props on each run and must not re-trigger a probe.
  }, [conversationId, isLoading]);

  /**
   * Keep a recovered prompt answerable for as long as it is displayed.
   *
   * Only for prompts recovered after a reload: a live one is held open by its
   * own stream, which vouches for the reviewer on its own. Re-reading the
   * pending approvals is the lightest request that counts as a sign of life,
   * and its result is deliberately ignored — this is a heartbeat, not a poll,
   * and a prompt that has since gone stale is better answered with the 409 the
   * reviewer can see than made to vanish under them.
   */
  useEffect(() => {
    if (!pendingApprovals?.length || !approvalDetachedRef.current) return;
    const convId = approvalConversationIdRef.current;
    const url = convId ? getPendingApprovalsUrl(convId) : null;
    if (!url) return;
    const id = window.setInterval(() => {
      fetch(url, { headers: { ...(requestHeaders ?? {}) } }).catch(() => {
        /* A missed heartbeat is survivable: the next one is well inside the
           server's window. */
      });
    }, APPROVAL_PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(id);
    // Re-armed whenever the prompt itself changes; the endpoint getter reads
    // current props on each run.
  }, [pendingApprovals]);

  /**
   * Watch a turn resumed by a decision made on a recovered prompt.
   *
   * The turn has no stream left to announce itself on, so its state is read
   * from the pause-recovery route: keep watching while it reports `running`,
   * and re-read the conversation once — the answer is there — when it reports
   * idle. Polling that route rather than the transcript is what makes the stop
   * condition definite instead of a guess, and it keeps the turn alive as a
   * side effect.
   *
   * A resumed turn can also pause *again* on a second gated call. With no
   * stream, this poll is the only way that prompt could ever reach the user, so
   * finding proposals puts the panel straight back into deciding.
   */
  useEffect(() => {
    if (!isResumingAfterDecision) return;
    const convId = approvalConversationIdRef.current;
    if (!convId) {
      setIsResumingAfterDecision(false);
      return;
    }
    if (Date.now() >= resumeDeadlineRef.current) {
      // Backstop only, for a turn-state marker that never clears. Re-read once
      // on the way out so a finished answer still lands.
      setIsResumingAfterDecision(false);
      reloadHistory();
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(async () => {
      const state = await readPendingApprovals(convId);
      if (cancelled) return;
      if (!state) {
        // Learned nothing — a transient failure. Try again rather than
        // declaring a running turn finished.
        setResumeTick((n) => n + 1);
        return;
      }
      if (state.proposals) {
        approvalDetachedRef.current = true;
        setApprovalError(null);
        setPendingApprovals(state.proposals);
        setIsResumingAfterDecision(false);
        return;
      }
      if (!state.turnRunning) {
        setIsResumingAfterDecision(false);
        reloadHistory();
        return;
      }
      setResumeTick((n) => n + 1);
    }, RESUME_POLL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [isResumingAfterDecision, resumeTick, reloadHistory]);

  // Steering affordances are only advertised when the typed text can actually
  // be dispatched mid-run: a response is streaming (isLoading), the REST steer
  // endpoint is configured, and the conversation already has a server id (the
  // very first turn of a fresh conversation only receives its id on `done`).
  const canSteer = isLoading && getSteerUrl() !== null && conversationId !== null;

  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    agentStatus,
    attachedFiles,
    conversationId,
    contextUsage,
    transferredAgent,
    canSteer,
    pendingApprovals,
    isSubmittingApproval,
    approvalError,
    submitApprovalDecisions,
    isResumingAfterDecision,
    historyReloadNonce,
    historyLoadedRef,
    conversationIdRef,
    handleFileAdd,
    handlePaste,
    handleSendMessage,
    sentTextOf,
    skipWait: skipWaitUrl ? skipWait : null,
    heldMessage,
    cancelHeldMessage: () => {
      if (heldMessageRef.current) onHeldSendSettledRef.current?.(heldMessageRef.current.text, 'cancelled');
      setHeldMessage(null);
    },
    reloadHistory,
    agentMentions,
    addAgentMention,
    handleNewChat,
    pendingWorkspaceId,
    clearPendingWorkspace,
    handleStopGenerating,
    conversationRefs,
    addConversationRef,
    setAttachedFiles,
    setMessages,
    setContextUsage,
    updateConversationId,
    handleSwitchConversation,
  };
}
