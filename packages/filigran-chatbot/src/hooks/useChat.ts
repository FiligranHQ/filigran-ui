import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentStatusState,
  ApiEndpoints,
  BackendType,
  ChatContextUsage,
  ChatFile,
  ChatMessage,
  ToolApprovalDecision,
  ToolApprovalProposal,
} from '../types';
import type { ParsedAction, ProtocolContext } from './protocols';
import { parseAgUiEvent, parseLegacyEvent, parseRestEvent } from './protocols';
import { parseToolApprovalProposals } from './protocols/parseRestEvent';

const STORAGE_KEY = 'filigranChatConversationId';
const LEGACY_CHAT_ID_KEY = 'filigranChatLegacyChatId';

/**
 * Unsent composer text is kept per conversation so closing the panel (hosts
 * unmount `<ChatPanel/>` when it is closed) or switching conversation doesn't
 * discard a half-written question. `sessionStorage`, not `localStorage`: a
 * draft is scoped to the tab and dies with it.
 */
const DRAFT_KEY_PREFIX = 'filigranChatDraft:';
/** Debounce on draft writes so a fast typist doesn't hit storage per keystroke. */
const DRAFT_PERSIST_DELAY_MS = 300;

const draftKey = (conversationId: string | null): string => `${DRAFT_KEY_PREFIX}${conversationId ?? 'new'}`;

function loadDraft(conversationId: string | null): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(draftKey(conversationId)) ?? '';
  } catch {
    // Storage can throw in restricted/private browsing contexts — a chat
    // without draft recovery is far better than a chat that fails to mount.
    return '';
  }
}

function persistDraft(conversationId: string | null, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) sessionStorage.setItem(draftKey(conversationId), value);
    else sessionStorage.removeItem(draftKey(conversationId));
  } catch {
    /* ignore — see loadDraft */
  }
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
  t: (key: string) => string;
  maxFileCount?: number;
  maxTotalSize?: number;
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
  handleSendMessage: () => Promise<void>;
  handleNewChat: () => void;
  handleStopGenerating: () => void;
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

function buildRequestBody(
  backendType: BackendType,
  content: string,
  opts: {
    legacyChatId: string | null;
    conversationId: string | null;
    agentSlug: string | null | undefined;
    pageContext?: Record<string, unknown>;
    /** See {@link ApiEndpoints.approve} — derived, never a prop of its own. */
    supportsToolApproval?: boolean;
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
      const body: Record<string, unknown> = { content, conversation_id: opts.conversationId, agent_slug: opts.agentSlug };
      // Tell the backend this turn may pause on a gated tool call and that we
      // will answer. Sent only when the host named an approve path, because
      // the flag is a promise: a backend that pauses waits indefinitely, so a
      // client that cannot answer must never claim it can. Omitted rather than
      // sent false, so a proxy that rebuilds the body from a fixed field list
      // drops nothing meaningful.
      if (opts.supportsToolApproval) {
        body.supports_tool_approval = true;
      }
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
  t,
  maxFileCount = DEFAULT_MAX_FILE_COUNT,
  maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
}: UseChatOptions): UseChatReturn {
  const isLegacy = backendType === 'legacy';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  // Seeded from the persisted draft of whichever conversation we mount into,
  // so re-opening the panel restores what the user had typed.
  const [inputValue, setInputValue] = useState(() => loadDraft(typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)));
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
  const [legacyChatId, setLegacyChatId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LEGACY_CHAT_ID_KEY);
  });

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasUsedToolsRef = useRef(false);
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
  // Mutex to prevent concurrent session creation
  const creatingSessionRef = useRef<Promise<string | null> | null>(null);
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
  const updateConversationId = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * Ensure a conversation exists. Uses a mutex so concurrent callers
   * (e.g. multiple files selected at once) share a single session creation.
   */
  const ensureConversation = async (slug: string | null | undefined): Promise<string | null> => {
    // Fast path: already have one
    if (conversationIdRef.current) return conversationIdRef.current;

    // If another call is already creating, wait for it
    if (creatingSessionRef.current) return creatingSessionRef.current;

    const sessionsUrl = getSessionsUrl();
    if (!sessionsUrl) return null;

    const promise = (async () => {
      try {
        const res = await fetch(sessionsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
          body: JSON.stringify({ agent_slug: slug }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const convId = (data?.conversation_id as string) ?? null;
        if (convId) {
          updateConversationId(convId);
        }
        return convId;
      } catch {
        return null;
      } finally {
        creatingSessionRef.current = null;
      }
    })();

    creatingSessionRef.current = promise;
    return promise;
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
  const steerMessage = async (content: string) => {
    const steerUrl = getSteerUrl();
    const convId = conversationIdRef.current;
    if (!steerUrl || !convId) return;

    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(steerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
        body: JSON.stringify({ conversation_id: convId, content, agent_slug: agentSlug }),
      });
      if (!res.ok) throw new Error(`Steer failed: ${res.status}`);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputValue((prev) => (prev ? `${content}\n${prev}` : content));
    }
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
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
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
        if (approvalDetachedRef.current) {
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
        res.status === 409
          ? t('This turn is no longer waiting for a decision.')
          : t('Could not send your decision. Please try again.'),
      );
    } catch {
      setApprovalError(t('Could not send your decision. Please try again.'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleSendMessage = async () => {
    const steerText = inputValue.trim();
    if (isLoading) {
      // Mid-run steering — text-only sends while a response is streaming.
      // Attachments keep the legacy wait behavior (the upload + message pair
      // cannot be injected into a running loop).
      if (steerText && attachedFiles.length === 0 && getSteerUrl() && conversationIdRef.current) {
        setInputValue('');
        await steerMessage(steerText);
      }
      return;
    }
    if (!inputValue.trim() && attachedFiles.length === 0) return;
    const content = inputValue.trim();

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    // Clear attachment chips after sending so the input returns to a clean state.
    setAttachedFiles([]);
    setIsLoading(true);
    setAgentStatus({ status: 'thinking' });
    hasUsedToolsRef.current = false;

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

    // The assistant message currently being streamed into. A steered turn can
    // produce multiple response segments on one SSE stream: the backend
    // completes the current segment (intermediate `done`), then runs a
    // follow-up pass for the steering message (fresh `thinking` + `stream`
    // events). Each segment gets its own assistant bubble. Declared outside
    // the try so the catch below writes the error into the LIVE segment, not
    // an already-completed one.
    let currentAssistantId = assistantId;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Collect file_ids from already-uploaded files (uploaded eagerly on selection)
      const fileIds = (userMsg.files ?? []).filter((f) => f.uploadStatus === 'done' && f.fileId).map((f) => f.fileId!);

      // Step 1: Send the message (with file_ids if files were uploaded)
      // Use conversationIdRef to get the latest value (may have been set by eager upload)
      const requestBody = buildRequestBody(backendType, content, {
        legacyChatId,
        conversationId: conversationIdRef.current,
        agentSlug,
        pageContext: pageContextRef.current,
        supportsToolApproval: getApproveUrl() !== null,
      });
      if (fileIds.length > 0) {
        (requestBody as Record<string, unknown>).file_ids = fileIds;
      }

      setAgentStatus({ status: 'thinking' });

      const res = await fetch(getMessagesUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: t('Unable to connect. Please check the configuration.') } : m)),
        );
        return;
      }

      const parseEvent = getParser(backendType);
      const ctx: ProtocolContext = { hasUsedTools: false, activeNodeId: '' };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let doneReceived = false;

      /**
       * Open a new response segment when events keep flowing after a `done`.
       * Appends a fresh empty assistant message (after any steered user
       * bubble) and resets the per-segment accumulators. The fresh `thinking`
       * status also clears the reasoning window — each segment carries its
       * own reasoning, mirroring the web chat behavior.
       */
      const ensureSegment = () => {
        if (!doneReceived) return;
        doneReceived = false;
        accumulated = '';
        currentAssistantId = crypto.randomUUID();
        const segmentId = currentAssistantId;
        setMessages((prev) => [...prev, { id: segmentId, role: 'assistant', content: '', timestamp: new Date() }]);
        setAgentStatus({ status: 'thinking' });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, '');
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
          try {
            const evt = JSON.parse(jsonStr) as Record<string, unknown>;
            const parsed: ParsedAction = parseEvent(evt, ctx);

            // Sync ref → context for cross-event tracking
            ctx.hasUsedTools = ctx.hasUsedTools || hasUsedToolsRef.current;

            switch (parsed.action) {
              case 'status': {
                ensureSegment();
                const segId = currentAssistantId;
                // Orthogonal to the status label below: a progress frame can
                // carry a fresh context reading whatever phase it announces.
                if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
                if (parsed.status === 'tool_start') hasUsedToolsRef.current = true;
                if (parsed.status === 'stream_retract') {
                  // Rare: text that streamed as a provisional answer turned
                  // out to precede tool calls — discard the answer bubble
                  // (the text re-arrives as thinking_text right after, so it
                  // lands in the reasoning window instead).
                  accumulated = '';
                  setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: '' } : m)));
                  setAgentStatus((prev) => ({
                    status: 'analyzing',
                    thinkingContent: prev?.thinkingContent,
                  }));
                } else if (parsed.status === 'thinking_text') {
                  setAgentStatus((prev) => ({
                    ...prev,
                    status: prev?.status ?? 'thinking',
                    thinkingContent: (prev?.thinkingContent ?? '') + (parsed.thinkingContent ?? ''),
                  }));
                } else if (parsed.status === 'tool_heartbeat') {
                  // Liveness signal during a long tool execution: update the
                  // elapsed counter but KEEP the current status label/tools —
                  // replacing the status would flip e.g. "Waiting for
                  // background task…" back to "Thinking…" mid-execution.
                  // Re-anchor the elapsed origin on every beat so the local
                  // 1s ticker in ChatThinking stays true to the server clock.
                  const elapsedStartMs = typeof parsed.elapsedS === 'number' ? Date.now() - parsed.elapsedS * 1000 : undefined;
                  setAgentStatus((prev) =>
                    prev
                      ? { ...prev, elapsedS: parsed.elapsedS, elapsedStartMs }
                      : { status: 'tool_start', tools: parsed.tools, elapsedS: parsed.elapsedS, elapsedStartMs },
                  );
                } else {
                  setAgentStatus((prev) => ({
                    status: parsed.status,
                    tools: parsed.tools,
                    thinkingContent: prev?.thinkingContent,
                  }));
                }
                break;
              }

              case 'stream': {
                ensureSegment();
                accumulated += parsed.content;
                // Snapshot the segment id and text: the state updater runs
                // asynchronously and `currentAssistantId` / `accumulated` may
                // already belong to the NEXT segment by then.
                const segId = currentAssistantId;
                const text = accumulated;
                setAgentStatus((prev) => ({ status: 'streaming', thinkingContent: prev?.thinkingContent }));
                setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text } : m)));
                break;
              }

              case 'done': {
                doneReceived = true;
                // A completed segment cannot still be waiting on a decision, so
                // any prompt left standing (a submission that failed against a
                // turn somebody else already answered) is stale.
                setPendingApprovals(null);
                setApprovalError(null);
                if (parsed.conversationId) {
                  updateConversationId(parsed.conversationId);
                }
                // Closing reading wins: a turn whose last iteration compacted
                // ends lower than it peaked mid-run.
                if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
                if (parsed.transferAgentId && parsed.transferAgentName) {
                  setTransferredAgent({ id: parsed.transferAgentId, name: parsed.transferAgentName });
                }
                const segId = currentAssistantId;
                const finalContent = parsed.content || accumulated;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === segId
                      ? {
                          ...m,
                          content: finalContent,
                          toolNames: parsed.toolNames,
                          toolCallCount: parsed.toolCallCount,
                          iterations: parsed.iterations,
                          attachments: parsed.attachments,
                          reasoning: parsed.reasoning,
                          toolCallTrace: parsed.toolCallTrace,
                          transferChain: parsed.transferChain,
                          isTruncated: parsed.isTruncated,
                        }
                      : m,
                  ),
                );
                break;
              }

              case 'approval_required': {
                // The turn stops here and the stream goes silent until a
                // decision is POSTed back. Not an end state: no segment is
                // opened or closed, `isLoading` stays true, and the rest of
                // the turn arrives on this same reader afterwards.
                approvalConversationIdRef.current = parsed.conversationId ?? conversationIdRef.current;
                setApprovalError(null);
                setPendingApprovals(parsed.proposals);
                // Keep whatever reasoning the turn had already streamed: the
                // pause interrupts the turn, it does not start a new one, and
                // the prose leading up to the proposed call is exactly the
                // context the reviewer is about to judge it on.
                setAgentStatus((prev) => (prev ? { ...prev, status: 'awaiting_approval' } : { status: 'awaiting_approval' }));
                break;
              }

              case 'error': {
                ensureSegment();
                const segId = currentAssistantId;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === segId ? { ...m, content: parsed.content || t('Unable to connect. Please check the configuration.') } : m,
                  ),
                );
                return;
              }

              case 'set_chat_id':
                setLegacyChatId(parsed.chatId);
                localStorage.setItem(LEGACY_CHAT_ID_KEY, parsed.chatId);
                break;

              case 'noop':
                break;
            }

            // Keep ref in sync with context
            hasUsedToolsRef.current = ctx.hasUsedTools;
          } catch {
            /* skip malformed SSE */
          }
        }
      }
      if (accumulated && !doneReceived) {
        const segId = currentAssistantId;
        const text = accumulated;
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text || 'No response.' } : m)));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const segId = currentAssistantId;
      setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: t('Sorry, an error occurred. Please try again.') } : m)));
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setAgentStatus(null);
      hasUsedToolsRef.current = false;
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
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    // Cancel any in-flight file uploads
    uploadAbortRef.current.abort();
    uploadAbortRef.current = new AbortController();
    creatingSessionRef.current = null;
    setMessages([]);
    setInputValue('');
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
    hasUsedToolsRef.current = false;
    historyLoadedRef.current = false;
    if (isLegacy) {
      setLegacyChatId(null);
      localStorage.removeItem(LEGACY_CHAT_ID_KEY);
    } else {
      updateConversationId(null);
    }
  };

  const handleSwitchConversation = (id: string) => {
    if (!isLegacy && id === conversationIdRef.current) return;
    // Reuse the full new-chat reset (abort in-flight request + uploads,
    // clear transcript/composer/status), then adopt the selected id and
    // re-arm the history-restore effect so the host panel fetches the
    // conversation's messages via the sessions endpoint.
    handleNewChat();
    if (!isLegacy) {
      updateConversationId(id);
      // `handleNewChat` blanked the composer; bring back this conversation's
      // own unsent draft, if any.
      setInputValue(loadDraft(id));
    }
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setAgentStatus(null);
    hasUsedToolsRef.current = false;
    // Stopping IS the way out of a pause the reviewer does not want to answer:
    // the backend waits indefinitely by design, so abandoning the stream is
    // the client's only other move.
    setPendingApprovals(null);
    setApprovalError(null);
    setIsResumingAfterDecision(false);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && !m.content)));
  };

  // Persist the composer draft against the conversation it belongs to. Writing
  // an empty value removes the entry, so sending (which blanks the composer)
  // also clears the draft — no explicit cleanup needed at the send sites.
  useEffect(() => {
    const id = window.setTimeout(() => persistDraft(conversationId, inputValue), DRAFT_PERSIST_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [inputValue, conversationId]);

  // Flush the pending draft on unmount. Hosts unmount the panel the instant it
  // is closed, which would otherwise drop anything typed inside the debounce
  // window — exactly the keystrokes the draft exists to protect.
  const draftFlushRef = useRef({ conversationId, inputValue });
  draftFlushRef.current = { conversationId, inputValue };
  useEffect(
    () => () => {
      const { conversationId: id, inputValue: value } = draftFlushRef.current;
      persistDraft(id, value);
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
    handleNewChat,
    handleStopGenerating,
    setAttachedFiles,
    setMessages,
    setContextUsage,
    updateConversationId,
    handleSwitchConversation,
  };
}
