import { useRef, useState } from 'react';
import type { AgentStatusState, ApiEndpoints, BackendType, ChatFile, ChatMessage } from '../types';
import type { ParsedAction, ProtocolContext } from './protocols';
import { parseAgUiEvent, parseLegacyEvent, parseRestEvent } from './protocols';

const STORAGE_KEY = 'filigranChatConversationId';
const LEGACY_CHAT_ID_KEY = 'filigranChatLegacyChatId';

interface UseChatOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  agentSlug: string | null | undefined;
  t: (key: string) => string;
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
  opts: { legacyChatId: string | null; conversationId: string | null; agentSlug: string | null | undefined },
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
    default:
      return { content, conversation_id: opts.conversationId, agent_slug: opts.agentSlug };
  }
}

export function useChat({ apiBaseUrl, apiEndpoints, backendType = 'rest', agentSlug, t }: UseChatOptions): UseChatReturn {
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

  // Determine message endpoint URL
  const getMessagesUrl = () => {
    if (isLegacy || apiEndpoints?.singleEndpoint) {
      return apiBaseUrl; // POST directly to base URL
    }
    return `${apiBaseUrl}${apiEndpoints?.messages ?? '/chat/messages'}`;
  };

  const handleFileAdd = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: ChatFile[] = [];
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        });
        if (newFiles.length === fileList.length) {
          setAttachedFiles((prev) => [...prev, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
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
    setAttachedFiles([]);
    setIsLoading(true);
    setAgentStatus({ status: 'thinking' });
    hasUsedToolsRef.current = false;

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestBody = buildRequestBody(backendType, content, { legacyChatId, conversationId, agentSlug });

      const res = await fetch(getMessagesUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
                setAgentStatus({ status: 'streaming' });
                setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)));
                break;

              case 'done':
                doneReceived = true;
                if (parsed.conversationId) {
                  setConversationId(parsed.conversationId);
                  localStorage.setItem(STORAGE_KEY, parsed.conversationId);
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
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: t('Sorry, an error occurred. Please try again.') } : m)),
      );
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
      setConversationId(null);
      localStorage.removeItem(STORAGE_KEY);
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
