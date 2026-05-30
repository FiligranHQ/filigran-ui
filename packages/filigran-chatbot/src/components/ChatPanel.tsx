import { type FunctionComponent, useCallback, useEffect, useState } from 'react';
import type { ChatAttachment, ChatMessage, ChatPanelProps } from '../types';
import { hexAlpha, identity } from '../utils';
import { parseAttachments } from '../hooks/protocols/parseRestEvent';
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
const SIDEBAR_GAP = 6;

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
  apiEndpoints,
  agentDashboardUrl,
  user,
  t = identity,
  accentColor = '#7b5cff',
  logoIcon,
  promptSuggestions = DEFAULT_SUGGESTIONS,
  draftBorderColor,
  resizable = false,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  disableFileManagement = false,
  onRelativeLinkClick,
  maxFileCount,
  maxTotalSize,
  requestHeaders,
  pushContentSelector,
  backendType = 'rest',
}) => {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const { agents, selectedAgent, agentMenuOpen, setAgentMenuOpen, handleSwitchAgent } = useAgents({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
  });

  const {
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
  } = useChat({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    agentSlug: selectedAgent?.slug,
    requestHeaders,
    t,
    maxFileCount,
    maxTotalSize,
  });

  const { sidebarWidth, handleResizeStart, defaultWidth, isResizing } = useSidebarResize({
    mode,
    resizable,
    onWidthChange,
    onResizeStart,
    onResizeEnd,
  });

  // Push content when sidebar mode is active using CSS variable
  useEffect(() => {
    const width = mode === 'sidebar' ? (resizable ? sidebarWidth : defaultWidth) : 0;
    const pushWidth = width > 0 ? width + SIDEBAR_GAP : 0;

    // Set CSS variable on :root for any component to use
    document.documentElement.style.setProperty('--chatbot-sidebar-width', `${pushWidth}px`);
    document.documentElement.style.setProperty('--chatbot-transition', isResizing ? 'none' : 'all 225ms cubic-bezier(0.4, 0, 0.2, 1)');

    // Also apply to pushContentSelector if provided (for simple cases)
    if (pushContentSelector) {
      const contentElement = document.querySelector<HTMLElement>(pushContentSelector);
      if (contentElement) {
        const originalPaddingRight = contentElement.style.paddingRight;
        const originalTransition = contentElement.style.transition;

        contentElement.style.paddingRight = pushWidth > 0 ? `${pushWidth}px` : '';
        contentElement.style.transition = isResizing ? 'none' : 'padding-right 225ms cubic-bezier(0.4, 0, 0.2, 1)';

        return () => {
          contentElement.style.paddingRight = originalPaddingRight;
          contentElement.style.transition = originalTransition;
          document.documentElement.style.setProperty('--chatbot-sidebar-width', '0px');
        };
      }
    }

    return () => {
      document.documentElement.style.setProperty('--chatbot-sidebar-width', '0px');
    };
  }, [pushContentSelector, mode, sidebarWidth, defaultWidth, resizable, isResizing]);

  const resolvedLogo = logoIcon ?? <DefaultLogoIcon size={24} />;
  const firstName = user.firstName;
  const agentName = transferredAgent?.name || selectedAgent?.name || 'Assistant';

  // Download an agent-generated file. The URL is resolved against the host
  // app's own backend proxy (apiBaseUrl), NOT the upstream chat service:
  // the proxy mints any upstream token server-side, so the user stays
  // authenticated to the host platform (e.g. OpenCTI / OpenAEV) only and
  // never logs in to the upstream service. Same-origin cookies +
  // requestHeaders (CSRF / draft context) carry the host-app auth.
  // Downloads need a path to build the URL from. Enabled for the REST
  // backend unless explicitly disabled (`download === null`). In
  // single-endpoint mode there is no per-path routing, so a download path
  // must be provided explicitly (e.g. an OpenCTI-style proxy route);
  // otherwise the default REST `/chat/files` path is used.
  const downloadPathProvided =
    apiEndpoints?.download !== null && apiEndpoints?.download !== undefined;
  const canDownload =
    backendType === 'rest' &&
    apiEndpoints?.download !== null &&
    (!apiEndpoints?.singleEndpoint || downloadPathProvided);

  const handleDownloadFile = useCallback(
    async (att: ChatAttachment) => {
      const base = apiEndpoints?.download ?? '/chat/files';
      const url = `${apiBaseUrl}${base}/${encodeURIComponent(att.fileId)}/download`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { ...(requestHeaders ?? {}) },
        });
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = att.filename || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Best-effort: the host app surfaces network/permission errors via
        // its own console; the lib has no toast surface of its own.
      }
    },
    [apiBaseUrl, apiEndpoints, requestHeaders],
  );

  const cssVars = {
    '--chat-accent': accentColor,
    '--chat-accent-10': hexAlpha(accentColor, 0.1),
    '--chat-accent-40': hexAlpha(accentColor, 0.25),
    '--chat-accent-50': hexAlpha(accentColor, 0.5),
    '--chat-accent-dark': accentColor,
  } as React.CSSProperties;

  // Load conversation history when agent is selected
  useEffect(() => {
    // Skip session history if disabled, using single endpoint mode, or non-REST backend
    if (apiEndpoints?.sessions === null || apiEndpoints?.singleEndpoint || backendType === 'legacy' || backendType === 'ag-ui') return;
    if (!conversationId || historyLoadedRef.current || !selectedAgent) return;
    historyLoadedRef.current = true;
    const sessionsUrl = `${apiBaseUrl}${apiEndpoints?.sessions ?? '/chat/sessions'}`;

    const clearStaleConversation = () => {
      setConversationId(null);
      localStorage.removeItem('filigranChatConversationId');
    };

    fetch(sessionsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
      body: JSON.stringify({
        conversation_id: conversationId,
        agent_slug: selectedAgent.slug,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          clearStaleConversation();
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.messages?.length) return;
        const restored: ChatMessage[] = data.messages.map(
          (m: { role: string; content: string; attachments?: unknown }, i: number) => ({
            id: `restored-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(),
            // Re-surface agent-generated download chips on conversation
            // restore (the [[FILE:…]] markers in content are stripped at
            // render time by ChatMessages).
            attachments: m.role === 'assistant' ? parseAttachments(m.attachments) : undefined,
          }),
        );
        setMessages(restored);
      })
      .catch(() => {
        clearStaleConversation();
      });
  }, [conversationId, selectedAgent, apiBaseUrl, apiEndpoints, historyLoadedRef, requestHeaders, setMessages, setConversationId]);

  const onSwitchAgent = (agent: typeof selectedAgent) => {
    if (!agent) return;
    handleSwitchAgent(agent, () => {
      handleNewChat();
    });
  };

  const containerClasses = (() => {
    const base = 'filigran-chatbot';
    switch (mode) {
      case 'sidebar':
        return `${base} fixed right-0 bottom-0 flex flex-col bg-white dark:bg-[#1e1e2e] border-l border-gray-200 dark:border-white/10 z-[1200]`;
      case 'floating':
        return `${base} fixed bottom-5 right-5 flex flex-col bg-white dark:bg-[#1e1e2e] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[1300] border border-gray-200 dark:border-white/10`;
      case 'fullscreen':
        return `${base} fixed right-0 bottom-0 left-0 flex flex-col bg-gray-50 dark:bg-[#161622] z-[1400]`;
      default:
        return base;
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
        <div onMouseDown={handleResizeStart} className="absolute top-0 -left-1 bottom-0 w-2 cursor-col-resize z-10 group">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bottom-0 w-0.5 rounded-sm bg-[var(--chat-accent)] opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
        </div>
      )}
      <ChatHeader
        mode={mode}
        agentName={agentName}
        agents={agents}
        selectedAgent={selectedAgent}
        transferredFrom={transferredAgent ? selectedAgent?.name : undefined}
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
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          agentStatus={agentStatus}
          agentName={agentName}
          logoIcon={resolvedLogo}
          onRelativeLinkClick={onRelativeLinkClick}
          onDownloadFile={canDownload ? handleDownloadFile : undefined}
          t={t}
        />
      )}
      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSendMessage}
        onStop={handleStopGenerating}
        isLoading={isLoading}
        attachedFiles={disableFileManagement ? [] : attachedFiles}
        onFileAdd={disableFileManagement ? undefined : handleFileAdd}
        onFileRemove={disableFileManagement ? undefined : (i) => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
        onPaste={disableFileManagement ? undefined : handlePaste}
        t={t}
        mode={mode}
        separatorColor={draftBorderColor}
      />
    </div>
  );
};
