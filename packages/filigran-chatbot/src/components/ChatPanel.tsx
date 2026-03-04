import { type FunctionComponent, useEffect, useState } from 'react';
import type { ChatMessage, ChatPanelProps } from '../types';
import { hexAlpha, identity } from '../utils';
import { useChat } from '../hooks/useChat';
import { useAgents } from '../hooks/useAgents';
import { useSidebarResize } from '../hooks/useSidebarResize';
import { DefaultLogoIcon } from './icons';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatWelcome } from './ChatWelcome';

const FLOATING_WIDTH = 380;
const FLOATING_HEIGHT = 560;

const DEFAULT_SUGGESTIONS = [
  'Help me create a new simulation scenario',
  'What are the latest attack patterns?',
  'How do I configure detection rules?',
  'Summarize my recent findings',
];

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
  resizable = false,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}) => {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const { agents, selectedAgent, agentMenuOpen, setAgentMenuOpen, handleSwitchAgent } = useAgents({ apiBaseUrl });

  const {
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
  } = useChat({ apiBaseUrl, agentSlug: selectedAgent?.slug, t });

  const { sidebarWidth, handleResizeStart, defaultWidth } = useSidebarResize({
    mode,
    resizable,
    onWidthChange,
    onResizeStart,
    onResizeEnd,
  });

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

  // Load conversation history when agent is selected
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
  }, [conversationId, selectedAgent, apiBaseUrl, historyLoadedRef, setMessages]);

  const onSwitchAgent = (agent: typeof selectedAgent) => {
    if (!agent) return;
    handleSwitchAgent(agent, () => {
      handleNewChat();
    });
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
      ? { top: topOffset, width: resizable ? sidebarWidth : defaultWidth }
      : mode === 'floating'
        ? { width: FLOATING_WIDTH, height: FLOATING_HEIGHT }
        : { top: topOffset }),
  };

  return (
    <div className={containerClasses} style={containerStyle}>
      {mode === 'sidebar' && resizable && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 -left-1 bottom-0 w-2 cursor-col-resize z-10 group"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bottom-0 w-0.5 rounded bg-[var(--chat-accent)] opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
        </div>
      )}
      <ChatHeader
        mode={mode}
        agentName={agentName}
        agents={agents}
        selectedAgent={selectedAgent}
        agentMenuOpen={agentMenuOpen}
        onAgentMenuToggle={() => setAgentMenuOpen((p) => !p)}
        onAgentMenuClose={() => setAgentMenuOpen(false)}
        onSwitchAgent={onSwitchAgent}
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
