import { useRef, useState } from 'react';
import type { AgentStatusState, ApiEndpoints, BackendType, ChatFile, ChatMessage } from '../types';
import type { ParsedAction, ProtocolContext } from './protocols';
import { parseAgUiEvent, parseLegacyEvent, parseRestEvent } from './protocols';

const STORAGE_KEY = 'filigranChatConversationId';
const LEGACY_CHAT_ID_KEY = 'filigranChatLegacyChatId';

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
  transferredAgent: TransferredAgent | null;
  historyLoadedRef: React.MutableRefObject<boolean>;
  handleFileAdd: (fileList: FileList | null) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleSendMessage: () => Promise<void>;
  handleNewChat: () => void;
  handleStopGenerating: () => void;
  setAttachedFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
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
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  const [transferredAgent, setTransferredAgent] = useState<TransferredAgent | null>(null);
  const [legacyChatId, setLegacyChatId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LEGACY_CHAT_ID_KEY);
  });

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasUsedToolsRef = useRef(false);
  // Ref mirror of conversationId — always current across async boundaries
  const conversationIdRef = useRef(conversationId);
  // Ref mirror of pageContext so the value sent reflects the page the user is
  // on at send time, regardless of when the send handler closure was created.
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;
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
   * Update conversationId in both React state and the ref mirror.
   */
  const updateConversationId = (id: string | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

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

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;
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
              case 'status':
                if (parsed.status === 'tool_start') hasUsedToolsRef.current = true;
                if (parsed.status === 'thinking_text') {
                  setAgentStatus((prev) => ({
                    ...prev,
                    status: prev?.status ?? 'thinking',
                    thinkingContent: (prev?.thinkingContent ?? '') + (parsed.thinkingContent ?? ''),
                  }));
                } else {
                  setAgentStatus((prev) => ({
                    status: parsed.status,
                    tools: parsed.tools,
                    thinkingContent: prev?.thinkingContent,
                  }));
                }
                break;

              case 'stream':
                accumulated += parsed.content;
                setAgentStatus((prev) => ({ status: 'streaming', thinkingContent: prev?.thinkingContent }));
                setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)));
                break;

              case 'done':
                doneReceived = true;
                if (parsed.conversationId) {
                  updateConversationId(parsed.conversationId);
                }
                if (parsed.transferAgentId && parsed.transferAgentName) {
                  setTransferredAgent({ id: parsed.transferAgentId, name: parsed.transferAgentName });
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: parsed.content || accumulated,
                          toolNames: parsed.toolNames,
                          toolCallCount: parsed.toolCallCount,
                          iterations: parsed.iterations,
                          attachments: parsed.attachments,
                        }
                      : m,
                  ),
                );
                break;

              case 'error':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: parsed.content || t('Unable to connect. Please check the configuration.') } : m,
                  ),
                );
                return;

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
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated || 'No response.' } : m)));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: t('Sorry, an error occurred. Please try again.') } : m)));
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setAgentStatus(null);
      hasUsedToolsRef.current = false;
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
    hasUsedToolsRef.current = false;
    historyLoadedRef.current = false;
    if (isLegacy) {
      setLegacyChatId(null);
      localStorage.removeItem(LEGACY_CHAT_ID_KEY);
    } else {
      updateConversationId(null);
    }
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setAgentStatus(null);
    hasUsedToolsRef.current = false;
    setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && !m.content)));
  };

  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    agentStatus,
    attachedFiles,
    conversationId,
    transferredAgent,
    historyLoadedRef,
    handleFileAdd,
    handlePaste,
    handleSendMessage,
    handleNewChat,
    handleStopGenerating,
    setAttachedFiles,
    setMessages,
    setConversationId,
  };
}
