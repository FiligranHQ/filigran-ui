import { type FunctionComponent, useEffect, useRef, useState } from 'react';
import type { AgentStatusState, ChatFile, ChatMessage, ChatPanelProps, XtmAgent } from '../types';
import { hexAlpha, identity } from '../utils';
import { DefaultLogoIcon } from './icons';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatWelcome } from './ChatWelcome';

const SIDEBAR_WIDTH = 400;
const FLOATING_WIDTH = 380;
const FLOATING_HEIGHT = 560;

const DEFAULT_SUGGESTIONS = [
  'Help me create a new simulation scenario',
  'What are the latest attack patterns?',
  'How do I configure detection rules?',
  'Summarize my recent findings',
];

const STORAGE_KEY = 'filigranChatConversationId';
const STORAGE_AGENT_KEY = 'filigranChatAgentSlug';

export const ChatPanel: FunctionComponent<ChatPanelProps> = ({
  mode,
  onClose,
  onModeChange,
  topOffset = 0,
  apiBaseUrl,
  agentDashboardUrl,
  user,
  t = identity,
  accentColor = '#7b5cff',
  logoIcon,
  promptSuggestions = DEFAULT_SUGGESTIONS,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [agents, setAgents] = useState<XtmAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<XtmAgent | null>(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasUsedToolsRef = useRef(false);

  const resolvedLogo = logoIcon ?? <DefaultLogoIcon size={24} />;
  const firstName = user.firstName;
  const agentName = selectedAgent?.name || 'Assistant';

  const cssVars = {
    '--chat-accent': accentColor,
    '--chat-accent-10': hexAlpha(accentColor, 0.1),
    '--chat-accent-40': hexAlpha(accentColor, 0.25),
    '--chat-accent-50': hexAlpha(accentColor, 0.5),
    '--chat-accent-dark': accentColor,
  } as React.CSSProperties;

  useEffect(() => {
    fetch(`${apiBaseUrl}/chat/agents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: XtmAgent[]) => {
        setAgents(data);
        if (data.length > 0 && !selectedAgent) {
          const savedSlug = localStorage.getItem(STORAGE_AGENT_KEY);
          const match = savedSlug ? data.find((a) => a.slug === savedSlug) : null;
          setSelectedAgent(match || data[0]);
        }
      })
      .catch(() => {});
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!conversationId || historyLoadedRef.current || !selectedAgent) return;
    historyLoadedRef.current = true;
    fetch(`${apiBaseUrl}/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        agent_slug: selectedAgent.slug,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.messages?.length) return;
        const restored: ChatMessage[] = data.messages.map((m: { role: string; content: string }, i: number) => ({
          id: `restored-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(),
        }));
        setMessages(restored);
      })
      .catch(() => {});
  }, [conversationId, selectedAgent, apiBaseUrl]);

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
          agent_slug: selectedAgent?.slug,
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

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // eslint-disable-next-line no-await-in-loop
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

  const handleSwitchAgent = (agent: XtmAgent) => {
    if (agent.id === selectedAgent?.id) {
      setAgentMenuOpen(false);
      return;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedAgent(agent);
    if (agent.slug) localStorage.setItem(STORAGE_AGENT_KEY, agent.slug);
    setAgentMenuOpen(false);
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

  const containerClasses = (() => {
    switch (mode) {
      case 'sidebar':
        return 'fixed right-0 bottom-0 flex flex-col bg-white dark:bg-[#1e1e2e] border-l border-gray-200 dark:border-white/10 z-[1200]';
      case 'floating':
        return 'fixed bottom-5 right-5 flex flex-col bg-white dark:bg-[#1e1e2e] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[1300] border border-gray-200 dark:border-white/10';
      case 'fullscreen':
        return 'fixed right-0 bottom-0 left-0 flex flex-col bg-gray-50 dark:bg-[#161622] z-[1400]';
      default:
        return '';
    }
  })();

  const containerStyle: React.CSSProperties = {
    ...cssVars,
    ...(mode === 'sidebar'
      ? { top: topOffset, width: SIDEBAR_WIDTH }
      : mode === 'floating'
        ? { width: FLOATING_WIDTH, height: FLOATING_HEIGHT }
        : { top: topOffset }),
  };

  return (
    <div className={containerClasses} style={containerStyle}>
      <ChatHeader
        mode={mode}
        agentName={agentName}
        agents={agents}
        selectedAgent={selectedAgent}
        agentMenuOpen={agentMenuOpen}
        onAgentMenuToggle={() => setAgentMenuOpen((p) => !p)}
        onAgentMenuClose={() => setAgentMenuOpen(false)}
        onSwitchAgent={handleSwitchAgent}
        modeMenuOpen={modeMenuOpen}
        onModeMenuToggle={() => setModeMenuOpen((p) => !p)}
        onModeMenuClose={() => setModeMenuOpen(false)}
        onModeChange={onModeChange}
        onNewChat={handleNewChat}
        onClose={onClose}
        logoIcon={resolvedLogo}
        agentDashboardUrl={agentDashboardUrl}
        t={t}
      />
      {messages.length === 0 ? (
        <ChatWelcome firstName={firstName} logoIcon={resolvedLogo} promptSuggestions={promptSuggestions} onPromptClick={setInputValue} t={t} />
      ) : (
        <ChatMessages messages={messages} isLoading={isLoading} agentStatus={agentStatus} agentName={agentName} logoIcon={resolvedLogo} t={t} />
      )}
      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSendMessage}
        onStop={handleStopGenerating}
        isLoading={isLoading}
        attachedFiles={attachedFiles}
        onFileAdd={handleFileAdd}
        onFileRemove={(i) => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
        onPaste={handlePaste}
        t={t}
        mode={mode}
      />
    </div>
  );
};
