import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatConversationSummary, ChatMode, XtmAgent } from '../types';
import { timeAgo } from '../utils';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  CloseIcon,
  EditIcon,
  ExternalLinkIcon,
  FloatingIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  HistoryIcon,
  SearchIcon,
  SidebarIcon,
  TrashIcon,
  UserPlusIcon,
} from './icons';
import { Dropdown } from './Dropdown';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

interface ChatHeaderProps {
  mode: ChatMode;
  agentName: string;
  agents: XtmAgent[];
  agentsLoading?: boolean;
  agentsError?: boolean;
  selectedAgent: XtmAgent | null;
  transferredFrom?: string;
  agentMenuOpen: boolean;
  onAgentMenuToggle: () => void;
  onAgentMenuClose: () => void;
  onSwitchAgent: (agent: XtmAgent) => void;
  modeMenuOpen: boolean;
  onModeMenuToggle: () => void;
  onModeMenuClose: () => void;
  onModeChange: (mode: ChatMode) => void;
  onNewChat: () => void;
  onClose: () => void;
  logoIcon: React.ReactNode;
  agentDashboardUrl?: string;
  /** Multi-conversation history menu (REST backend). Hidden when false. */
  historyEnabled?: boolean;
  historyMenuOpen?: boolean;
  onHistoryMenuToggle?: () => void;
  onHistoryMenuClose?: () => void;
  conversations?: ChatConversationSummary[];
  conversationsLoading?: boolean;
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  t: (key: string) => string;
}

const modeOptions: { mode: ChatMode; label: string; getIcon: (p: { size: number; className: string }) => React.ReactNode }[] = [
  { mode: 'floating', label: 'Floating', getIcon: (p) => <FloatingIcon {...p} /> },
  { mode: 'sidebar', label: 'Sidebar', getIcon: (p) => <SidebarIcon {...p} /> },
  { mode: 'fullscreen', label: 'Full screen', getIcon: (p) => <FullscreenIcon {...p} /> },
];

export const ChatHeader = ({
  mode,
  agentName,
  agents,
  agentsLoading = false,
  agentsError = false,
  selectedAgent,
  transferredFrom,
  agentMenuOpen,
  onAgentMenuToggle,
  onAgentMenuClose,
  onSwitchAgent,
  modeMenuOpen,
  onModeMenuToggle,
  onModeMenuClose,
  onModeChange,
  onNewChat,
  onClose,
  logoIcon,
  agentDashboardUrl,
  historyEnabled = false,
  historyMenuOpen = false,
  onHistoryMenuToggle,
  onHistoryMenuClose,
  conversations = [],
  conversationsLoading = false,
  activeConversationId = null,
  onSelectConversation,
  onDeleteConversation,
  t,
}: ChatHeaderProps) => {
  const agentAnchorRef = useRef<HTMLButtonElement>(null);
  const modeAnchorRef = useRef<HTMLButtonElement>(null);
  const historyAnchorRef = useRef<HTMLButtonElement>(null);

  // Agent filter, mirroring the XTM One web chat's picker. Reset whenever the
  // menu closes so re-opening never starts on a stale query with most agents
  // hidden — which reads as "my agents disappeared".
  const [agentQuery, setAgentQuery] = useState('');
  useEffect(() => {
    if (!agentMenuOpen) setAgentQuery('');
  }, [agentMenuOpen]);

  // Match on name AND description: descriptions are what distinguish agents
  // whose names are near-identical, and they are already shown on every row.
  const filteredAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q));
  }, [agents, agentQuery]);

  // Only worth the vertical space once the list is long enough to scan for.
  const showAgentSearch = agents.length > 5;

  const CurrentModeIcon = mode === 'sidebar' ? SidebarIcon : mode === 'fullscreen' ? FullscreenExitIcon : FloatingIcon;

  return (
    <div
      className={`flex items-center px-3 py-2 min-h-[48px] border-b border-gray-200 dark:border-white/10 bg-gradient-to-br from-[var(--chat-accent-dark)]/[0.13] to-[var(--chat-accent)]/[0.07] ${mode === 'floating' ? 'rounded-t-xl' : ''}`}
    >
      <div className="min-w-0">
        <button
          ref={agentAnchorRef}
          type="button"
          onClick={onAgentMenuToggle}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <span className="flex items-center text-[var(--chat-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">{logoIcon}</span>
          <span>{agentName}</span>
          <ChevronDownIcon size={16} className="text-gray-400 dark:text-white/30" />
        </button>
        {transferredFrom && (
          <div className="pl-10 pr-2 text-[0.6rem] font-normal text-gray-400 dark:text-white/30">
            {t('Transferred from')} {transferredFrom}
          </div>
        )}
      </div>

      <Dropdown open={agentMenuOpen} onClose={onAgentMenuClose} anchorRef={agentAnchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">
          {t('Switch to another agent')}
        </span>
        {/* Three distinct states, because an empty array alone cannot tell them
            apart — and treating "failed" as "still loading" is what left this
            menu spinning forever against an unreachable backend.

            The last one is NOT "the catalogue is empty": XTM One always seeds
            agents, so a working backend never answers with none. It is reached
            when the fetch is skipped altogether — `apiEndpoints.agents: null`,
            single-endpoint mode (OpenCTI) or the legacy backend — where there
            is simply nothing to switch between. The menu still earns its place
            there: it carries the agent-dashboard links below. */}
        {agents.length === 0 && agentsLoading && (
          <div className="px-4 py-2">
            <Spinner size={16} />
          </div>
        )}
        {agents.length === 0 && !agentsLoading && agentsError && (
          <div className="px-4 py-3 flex items-start gap-2">
            <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="text-[0.75rem] leading-5 text-gray-600 dark:text-white/60">{t('Could not reach the assistant service. Check the connection and try again.')}</span>
          </div>
        )}
        {agents.length === 0 && !agentsLoading && !agentsError && (
          <div className="px-4 py-3 text-[0.75rem] text-gray-400 dark:text-white/40">{t('Agent switching is not available here')}</div>
        )}
        {showAgentSearch && (
          <div className="px-3 pb-2 pt-1">
            <div className="relative">
              <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" />
              <input
                autoFocus
                type="text"
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                // Escape closes the whole menu rather than only clearing the
                // query — the same key the rest of the panel uses to dismiss.
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onAgentMenuClose();
                }}
                placeholder={t('Search agents...')}
                aria-label={t('Search agents...')}
                className="w-full h-7 pl-7 pr-2 rounded-md bg-gray-100 dark:bg-white/[0.06] text-[0.75rem] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
              />
            </div>
          </div>
        )}
        <div className="max-h-[240px] overflow-y-auto filigran-chat-scrollable">
          {agents.length > 0 && filteredAgents.length === 0 && (
            <div className="px-4 py-3 text-[0.75rem] text-gray-400 dark:text-white/40">{t('No agent matches')}</div>
          )}
          {filteredAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSwitchAgent(agent)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                agent.id === selectedAgent?.id ? 'bg-[var(--chat-accent)]/10' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
                <span className="text-[var(--chat-accent)] [&>svg]:w-4 [&>svg]:h-4">{logoIcon}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[0.8125rem] font-medium text-gray-900 dark:text-white truncate">{agent.name}</div>
                {agent.description && <div className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">{agent.description}</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="h-px bg-gray-200 dark:bg-white/10 mx-2" />
        <div>
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <ExternalLinkIcon size={18} className="text-gray-400 dark:text-white/40 shrink-0" />
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t('Browse agents')}</span>
            </button>
          )}
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents/new`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <UserPlusIcon size={18} className="text-gray-400 dark:text-white/40 shrink-0" />
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t('Create agent')}</span>
            </button>
          )}
        </div>
      </Dropdown>

      <div className="flex-1" />

      {historyEnabled && (
        <>
          <Tooltip title={t('Conversation history')}>
            <button
              ref={historyAnchorRef}
              type="button"
              onClick={onHistoryMenuToggle}
              aria-label={t('Conversation history')}
              aria-haspopup="menu"
              aria-expanded={historyMenuOpen}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
            >
              <HistoryIcon size={18} />
            </button>
          </Tooltip>

          <Dropdown open={historyMenuOpen} onClose={() => onHistoryMenuClose?.()} anchorRef={historyAnchorRef} placement="bottom-end" width={300}>
            <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">
              {t('Conversation history')}
            </span>
            <div className="max-h-72 overflow-y-auto filigran-chat-scrollable">
              {conversationsLoading && conversations.length === 0 && (
                <div className="px-4 py-2">
                  <Spinner size={16} />
                </div>
              )}
              {!conversationsLoading && conversations.length === 0 && (
                <div className="px-4 py-3 text-[0.75rem] text-gray-400 dark:text-white/40">{t('No conversations yet')}</div>
              )}
              {conversations.map((conv) => {
                const isActive = conv.conversationId === activeConversationId;
                const when = timeAgo(conv.updatedAt, t);
                return (
                  <div
                    key={conv.conversationId}
                    className={`group flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                      isActive ? 'bg-[var(--chat-accent)]/10' : ''
                    }`}
                  >
                    <button type="button" onClick={() => onSelectConversation?.(conv.conversationId)} className="flex-1 min-w-0 text-left">
                      <div className="text-[0.8125rem] font-medium text-gray-900 dark:text-white truncate">
                        {conv.title || t('Untitled conversation')}
                      </div>
                      {when && <div className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">{when}</div>}
                    </button>
                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.conversationId)}
                        title={t('Delete conversation')}
                        aria-label={t('Delete conversation')}
                        className="shrink-0 p-1 rounded-md text-gray-400 dark:text-white/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-px bg-gray-200 dark:bg-white/10 mx-2" />
            <button
              type="button"
              onClick={() => {
                onHistoryMenuClose?.();
                onNewChat();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <EditIcon size={16} className="text-gray-400 dark:text-white/40 shrink-0" />
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t('New conversation')}</span>
            </button>
          </Dropdown>
        </>
      )}

      <Tooltip title={t('New chat')}>
        <button
          type="button"
          onClick={onNewChat}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
        >
          <EditIcon size={18} />
        </button>
      </Tooltip>

      <Tooltip title={t('Switch view')}>
        <button
          ref={modeAnchorRef}
          type="button"
          onClick={onModeMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
        >
          <CurrentModeIcon size={18} />
        </button>
      </Tooltip>

      <Dropdown open={modeMenuOpen} onClose={onModeMenuClose} anchorRef={modeAnchorRef} placement="bottom-end" width={180}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">{t('Switch to')}</span>
        <div className="pb-1">
          {modeOptions.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => {
                onModeChange(opt.mode);
                onModeMenuClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-1 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                mode === opt.mode ? 'bg-[var(--chat-accent)]/10' : ''
              }`}
            >
              {opt.getIcon({ size: 18, className: 'text-gray-400 dark:text-white/40' })}
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t(opt.label)}</span>
            </button>
          ))}
        </div>
      </Dropdown>

      <Tooltip title={t('Close')}>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
        >
          <CloseIcon size={18} />
        </button>
      </Tooltip>
    </div>
  );
};
