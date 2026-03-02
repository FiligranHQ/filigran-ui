import { useRef, useState } from 'react';
import type { AgentStatusState, ChatFile, ChatMessage } from '../types';

const STORAGE_KEY = 'filigranChatConversationId';

interface UseChatOptions {
  apiBaseUrl: string;
  agentSlug: string | null | undefined;
  t: (key: string) => string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  agentStatus: AgentStatusState | null;
  attachedFiles: ChatFile[];
  conversationId: string | null;
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

export function useChat({ apiBaseUrl, agentSlug, t }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasUsedToolsRef = useRef(false);

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
      const res = await fetch(`${apiBaseUrl}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          conversation_id: conversationId,
          agent_slug: agentSlug,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: t('Unable to connect. Please check the configuration.') } : m)),
        );
        return;
      }

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
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: evt.content || t('Unable to connect. Please check the configuration.') } : m,
                ),
              );
              return;
            }
            if (evt.type === 'status') {
              const st = evt.status as string;
              if (st === 'tool_done' || st === 'wind_down') {
                // skip transient internal events
              } else if (st === 'streaming') {
                setAgentStatus({ status: 'streaming' });
              } else if (st === 'tool_start') {
                hasUsedToolsRef.current = true;
                setAgentStatus({ status: 'tool_start', tools: evt.tools });
              } else if (st === 'thinking' && hasUsedToolsRef.current) {
                setAgentStatus({ status: 'analyzing' });
              } else {
                setAgentStatus({ status: st, tools: evt.tools });
              }
            } else if (evt.type === 'stream') {
              accumulated += evt.content;
              setAgentStatus({ status: 'streaming' });
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)));
            } else if (evt.type === 'done') {
              doneReceived = true;
              if (evt.conversation_id) {
                setConversationId(evt.conversation_id);
                localStorage.setItem(STORAGE_KEY, evt.conversation_id);
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: evt.content,
                        toolNames: evt.tool_names,
                        toolCallCount: evt.tool_call_count,
                        iterations: evt.iterations,
                      }
                    : m,
                ),
              );
            }
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
    setConversationId(null);
    setAttachedFiles([]);
    setIsLoading(false);
    setAgentStatus(null);
    hasUsedToolsRef.current = false;
    localStorage.removeItem(STORAGE_KEY);
    historyLoadedRef.current = false;
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
