import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatConversationSummary, ChatMode, ChatPanelMode, Translate, XtmAgent } from '../types';
import { agentIconKind, groupAgents, timeAgo, translate } from '../utils';
import {
  AlertTriangleIcon,
  BotIcon,
  CheckIcon,
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
import { ClearAllConversations } from './ClearAllConversations';
import { ConversationListFailed } from './ConversationListFailed';
import { Dropdown } from './Dropdown';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

interface ChatHeaderProps {
  /** Inline mode has neither the view switcher nor the close button. */
  mode: ChatPanelMode;
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
  onModeChange?: (mode: ChatMode) => void;
  onNewChat: () => void;
  onClose?: () => void;
  logoIcon: React.ReactNode;
  agentDashboardUrl?: string;
  /** Multi-conversation history menu (REST backend). Hidden when false. */
  historyEnabled?: boolean;
  historyMenuOpen?: boolean;
  onHistoryMenuToggle?: () => void;
  onHistoryMenuClose?: () => void;
  conversations?: ChatConversationSummary[];
  conversationsLoading?: boolean;
  /** The last read of the list failed: with no conversations, the menu says so instead of being empty. */
  conversationsFailed?: boolean;
  /** Reads the list again, offered when it could not be read. */
  onRetryConversations?: () => void;
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  /** Offers "Clear all conversations" under the history menu, confirmed first. */
  onClearAll?: () => void;
  /** What Clear all does, for its wording. */
  clearAllAction?: 'delete' | 'archive';
  /** The host's controls, before New chat. */
  actions?: React.ReactNode;
  /** Beside the agent's name. */
  title?: React.ReactNode;
  /** Under the agent's name. */
  subtitle?: React.ReactNode;
  /**
   * Where the agent's page is (`href`, already checked) and what opening it
   * does instead (`onClick`): the switcher's "Open agent page" item. The
   * header's agent control itself always opens the switcher.
   */
  agentLink?: { href?: string; onClick?: () => void };
  t: Translate;
}

const headerButton =
  'w-8 h-8 flex items-center justify-center rounded-lg hover:chat-surface-hover-100/10 chat-text-muted-500/40 hover:chat-text-secondary-700/70 transition-colors';

/** An agent's own icon when it has one the panel can draw, the panel's logo otherwise. */
const AgentIcon = ({ icon, fallback }: { icon: string | null | undefined; fallback: React.ReactNode }) => {
  const kind = agentIconKind(icon);
  if (kind === 'image') return <img src={icon!.trim()} alt="" className="w-4 h-4 rounded-sm object-cover" />;
  if (kind === 'emoji') return <span className="text-sm leading-none">{icon!.trim()}</span>;
  return <span className="text-[var(--chat-accent)] [&>svg]:w-4 [&>svg]:h-4">{fallback}</span>;
};

// Labels are thunks rather than bare strings so each key stays a literal call
// on the host's translator in the source: a table of plain keys resolved later
// through a variable works at runtime but is invisible to key extraction, which
// is how a locale ends up missing exactly the strings nobody typed by hand.
const modeOptions: { mode: ChatMode; label: (t: Translate) => string; getIcon: (p: { size: number; className: string }) => React.ReactNode }[] = [
  { mode: 'floating', label: (t) => t('Floating'), getIcon: (p) => <FloatingIcon {...p} /> },
  { mode: 'sidebar', label: (t) => t('Sidebar'), getIcon: (p) => <SidebarIcon {...p} /> },
  { mode: 'fullscreen', label: (t) => t('Full screen'), getIcon: (p) => <FullscreenIcon {...p} /> },
];

const menuItem = 'w-full flex items-center gap-2 px-4 py-1.5 text-left hover:chat-surface-hover-100/10 transition-colors';

/**
 * The switcher's "Open agent page" item: the address followed in place, unless
 * the host takes a plain click itself (`onClick`); a click with a modifier key
 * opens the address as the browser does. The menu closes either way.
 */
const AgentPageItem = ({ link, onDone, t }: { link: { href?: string; onClick?: () => void }; onDone: () => void; t: Translate }) => {
  const content = (
    <>
      <BotIcon size={18} className="chat-text-muted-400/40 shrink-0" />
      <span className="text-[0.8125rem] chat-text-secondary-700/70">{t('Open agent page')}</span>
    </>
  );
  if (!link.href) {
    return (
      <button
        type="button"
        onClick={() => {
          onDone();
          link.onClick?.();
        }}
        className={menuItem}
      >
        {content}
      </button>
    );
  }
  return (
    <a
      href={link.href}
      data-testid="filigran-chat-agent-page-link"
      onClick={(e) => {
        onDone();
        if (!link.onClick || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        link.onClick();
      }}
      className={menuItem}
    >
      {content}
    </a>
  );
};

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
  conversationsFailed = false,
  onRetryConversations,
  activeConversationId = null,
  onSelectConversation,
  onDeleteConversation,
  onClearAll,
  clearAllAction,
  actions,
  title,
  subtitle,
  agentLink,
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

  // The rows in the order they are drawn, so the arrow keys walk them as seen.
  const agentGroups = useMemo(() => groupAgents(filteredAgents), [filteredAgents]);
  const orderedAgents = useMemo(() => agentGroups.flatMap((g) => g.agents), [agentGroups]);

  // The row the keyboard is on: the current agent on opening, the first match
  // once the query changes.
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  useEffect(() => {
    if (!agentMenuOpen) return;
    const current = orderedAgents.findIndex((a) => a.id === selectedAgent?.id);
    setActiveAgentIndex(agentQuery.trim() || current < 0 ? 0 : current);
    // Only on opening and on a new query: a list re-read keeps the row.
  }, [agentMenuOpen, agentQuery]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeAgentIndex]);

  const onAgentSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes the whole menu rather than only clearing the query, the
    // same key the rest of the panel uses to dismiss.
    if (e.key === 'Escape') {
      onAgentMenuClose();
      return;
    }
    if (orderedAgents.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveAgentIndex((i) => (i + step + orderedAgents.length) % orderedAgents.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const agent = orderedAgents[Math.min(activeAgentIndex, orderedAgents.length - 1)];
      if (agent) onSwitchAgent(agent);
    }
  };

  // Searchable as soon as there is a list: typing is the quickest way to an agent.
  const showAgentSearch = agents.length > 0;

  const CurrentModeIcon = mode === 'sidebar' ? SidebarIcon : mode === 'fullscreen' ? FullscreenExitIcon : FloatingIcon;

  return (
    <div
      className={`flex items-center px-3 py-2 min-h-[48px] border-b chat-border-200/10 chat-header-surface ${mode === 'floating' ? 'rounded-t-xl' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          {/* One control: icon, name and chevron all open the switcher. The
              agent's page is an item of the menu, never this click. */}
          <button
            ref={agentAnchorRef}
            type="button"
            onClick={onAgentMenuToggle}
            aria-haspopup="listbox"
            aria-expanded={agentMenuOpen}
            title={t('Switch to another agent')}
            data-testid="filigran-chat-agent-switcher"
            className={`flex max-w-full min-w-0 items-center gap-1.5 text-sm font-semibold chat-text-900/100 pl-2 pr-1.5 py-1 rounded-lg border border-transparent hover:chat-surface-hover-100/10 hover:chat-border-200/10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--chat-accent)] transition-colors ${
              agentMenuOpen ? 'chat-surface-hover-100/10 chat-border-200/10' : ''
            }`}
          >
            <span className="flex shrink-0 items-center text-[var(--chat-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">{logoIcon}</span>
            <span className="min-w-0 truncate">{agentName}</span>
            <ChevronDownIcon
              size={16}
              className={`shrink-0 chat-text-muted-400/40 transition-transform ${agentMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {title && (
            <>
              <span aria-hidden className="shrink-0 chat-text-muted-400/30">
                /
              </span>
              <span data-testid="filigran-chat-header-title" className="min-w-0 truncate px-1 text-[0.8125rem] chat-text-secondary-700/70">
                {title}
              </span>
            </>
          )}
        </div>
        {transferredFrom && (
          <div className="pl-10 pr-2 text-[0.6rem] font-normal chat-text-muted-400/30">
            {translate(t, 'Transferred from {agent}', { agent: transferredFrom })}
          </div>
        )}
        {subtitle && (
          <div data-testid="filigran-chat-header-subtitle" className="truncate pl-10 pr-2 text-[0.6rem] font-normal chat-text-muted-400/40">
            {subtitle}
          </div>
        )}
      </div>

      <Dropdown open={agentMenuOpen} onClose={onAgentMenuClose} anchorRef={agentAnchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase chat-text-muted-400/40">{t('Switch to another agent')}</span>
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
            <span className="text-[0.75rem] leading-5 chat-text-secondary-600/60">
              {t('Could not reach the assistant service. Check the connection and try again.')}
            </span>
          </div>
        )}
        {agents.length === 0 && !agentsLoading && !agentsError && (
          <div className="px-4 py-3 text-[0.75rem] chat-text-muted-400/40">{t('Agent switching is not available here')}</div>
        )}
        {showAgentSearch && (
          <div className="px-3 pb-2 pt-1">
            <div className="relative">
              <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 chat-text-muted-400/40" />
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded
                aria-controls="filigran-chat-agent-options"
                aria-activedescendant={
                  orderedAgents[activeAgentIndex] ? `filigran-chat-agent-option-${orderedAgents[activeAgentIndex].id}` : undefined
                }
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                onKeyDown={onAgentSearchKeyDown}
                placeholder={t('Search agents...')}
                aria-label={t('Search agents...')}
                className="w-full h-7 pl-7 pr-2 rounded-md chat-surface-subtle-100/6 text-[0.75rem] chat-text-900/100 placeholder:chat-text-muted-400/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
              />
            </div>
          </div>
        )}
        <div
          ref={listRef}
          id="filigran-chat-agent-options"
          role="listbox"
          aria-label={t('Switch to another agent')}
          className="max-h-[320px] overflow-y-auto filigran-chat-scrollable"
        >
          {agents.length > 0 && filteredAgents.length === 0 && (
            <div className="px-4 py-3 text-[0.75rem] chat-text-muted-400/40">{t('No agent matches')}</div>
          )}
          {agentGroups.map(({ group, agents: groupMembers }) => (
            <div key={group ?? ''} role="group" aria-label={group ?? undefined}>
              {group && (
                <span className="block px-4 pt-2 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide chat-text-muted-400/40">{group}</span>
              )}
              {groupMembers.map((agent) => {
                const index = orderedAgents.indexOf(agent);
                const isCurrent = agent.id === selectedAgent?.id;
                const isActive = index === activeAgentIndex;
                return (
                <button
                  key={agent.id}
                  id={`filigran-chat-agent-option-${agent.id}`}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  data-active={isActive ? 'true' : undefined}
                  tabIndex={-1}
                  onClick={() => onSwitchAgent(agent)}
                  onMouseMove={() => {
                    if (!isActive) setActiveAgentIndex(index);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                    isActive ? 'chat-surface-hover-100/10' : ''
                  } ${isCurrent ? 'bg-[var(--chat-accent)]/10' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
                    <AgentIcon icon={agent.icon} fallback={logoIcon} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="text-[0.8125rem] font-medium chat-text-900/100 truncate">{agent.name}</span>
                      {agent.badges?.map((badge) => (
                        <span
                          key={badge}
                          className="shrink-0 rounded bg-[var(--chat-accent)]/10 px-1 text-[0.6rem] leading-4 text-[var(--chat-accent)]"
                        >
                          {badge}
                        </span>
                      ))}
                      {agent.disableChat && (
                        <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[0.6rem] leading-4 text-amber-600 dark:text-amber-400">
                          {t('Not recommended for chat')}
                        </span>
                      )}
                    </div>
                    {agent.description && <div className="text-[0.7rem] chat-text-secondary-500/40 truncate">{agent.description}</div>}
                  </div>
                  {isCurrent && <CheckIcon size={14} className="ml-auto shrink-0 text-[var(--chat-accent)]" />}
                </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="h-px chat-border-fill-200/10 mx-2" />
        <div>
          {agentLink && <AgentPageItem link={agentLink} onDone={onAgentMenuClose} t={t} />}
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:chat-surface-hover-100/10 transition-colors"
            >
              <ExternalLinkIcon size={18} className="chat-text-muted-400/40 shrink-0" />
              <span className="text-[0.8125rem] chat-text-secondary-700/70">{t('Browse agents')}</span>
            </button>
          )}
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents/new`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:chat-surface-hover-100/10 transition-colors"
            >
              <UserPlusIcon size={18} className="chat-text-muted-400/40 shrink-0" />
              <span className="text-[0.8125rem] chat-text-secondary-700/70">{t('Create agent')}</span>
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
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:chat-surface-hover-100/10 chat-text-muted-500/40 hover:chat-text-secondary-700/70 transition-colors"
            >
              <HistoryIcon size={18} />
            </button>
          </Tooltip>

          <Dropdown open={historyMenuOpen} onClose={() => onHistoryMenuClose?.()} anchorRef={historyAnchorRef} placement="bottom-end" width={300}>
            <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase chat-text-muted-400/40">{t('Conversation history')}</span>
            <div className="max-h-72 overflow-y-auto filigran-chat-scrollable">
              {conversationsLoading && conversations.length === 0 && (
                <div className="px-4 py-2">
                  <Spinner size={16} />
                </div>
              )}
              {!conversationsLoading &&
                conversations.length === 0 &&
                (conversationsFailed ? (
                  <ConversationListFailed onRetry={() => onRetryConversations?.()} className="px-4 py-3" t={t} />
                ) : (
                  <div className="px-4 py-3 text-[0.75rem] chat-text-muted-400/40">{t('No conversations yet')}</div>
                ))}
              {conversations.map((conv) => {
                const isActive = conv.conversationId === activeConversationId;
                const when = timeAgo(conv.updatedAt, t);
                return (
                  <div
                    key={conv.conversationId}
                    className={`group flex items-center gap-2 px-4 py-1.5 hover:chat-surface-hover-100/10 transition-colors ${
                      isActive ? 'bg-[var(--chat-accent)]/10' : ''
                    }`}
                  >
                    <button type="button" onClick={() => onSelectConversation?.(conv.conversationId)} className="flex-1 min-w-0 text-left">
                      <div className="text-[0.8125rem] font-medium chat-text-900/100 truncate">{conv.title || t('Untitled conversation')}</div>
                      {when && <div className="text-[0.7rem] chat-text-muted-500/40 truncate">{when}</div>}
                    </button>
                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.conversationId)}
                        title={t('Delete conversation')}
                        aria-label={t('Delete conversation')}
                        className="shrink-0 p-1 rounded-md chat-text-muted-400/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-px chat-border-fill-200/10 mx-2" />
            <button
              type="button"
              onClick={() => {
                onHistoryMenuClose?.();
                onNewChat();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:chat-surface-hover-100/10 transition-colors"
            >
              <EditIcon size={16} className="chat-text-muted-400/40 shrink-0" />
              <span className="text-[0.8125rem] chat-text-secondary-700/70">{t('New conversation')}</span>
            </button>
            {onClearAll && conversations.length > 0 && (
              <ClearAllConversations
                onClear={() => {
                  onHistoryMenuClose?.();
                  onClearAll();
                }}
                action={clearAllAction}
                className="px-3 pb-2"
                iconButtonClass="p-1 rounded-md chat-text-muted-400/40 hover:chat-surface-hover-100/10 transition-colors"
                t={t}
              />
            )}
          </Dropdown>
        </>
      )}

      {actions}

      <Tooltip title={t('New chat')}>
        <button type="button" onClick={onNewChat} aria-label={t('New chat')} className={headerButton}>
          <EditIcon size={18} />
        </button>
      </Tooltip>

      {mode !== 'inline' && onModeChange && (
        <>
          <Tooltip title={t('Switch view')}>
            <button
              ref={modeAnchorRef}
              type="button"
              aria-label={t('Switch view')}
              onClick={onModeMenuToggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:chat-surface-hover-100/10 chat-text-muted-500/40 hover:chat-text-secondary-700/70 transition-colors"
            >
              <CurrentModeIcon size={18} />
            </button>
          </Tooltip>

          <Dropdown open={modeMenuOpen} onClose={onModeMenuClose} anchorRef={modeAnchorRef} placement="bottom-end" width={180}>
            <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase chat-text-muted-400/40">{t('Switch to')}</span>
            <div className="pb-1">
              {modeOptions.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    onModeChange(opt.mode);
                    onModeMenuClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-1 text-left hover:chat-surface-hover-100/10 transition-colors ${
                    mode === opt.mode ? 'bg-[var(--chat-accent)]/10' : ''
                  }`}
                >
                  {opt.getIcon({ size: 18, className: 'chat-text-muted-400/40' })}
                  <span className="text-[0.8125rem] chat-text-secondary-700/70">{opt.label(t)}</span>
                </button>
              ))}
            </div>
          </Dropdown>
        </>
      )}
      {mode !== 'inline' && onClose && (
        <>
          <Tooltip title={t('Close')}>
            <button
              type="button"
              aria-label={t('Close')}
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:chat-surface-hover-100/10 chat-text-muted-500/40 hover:chat-text-secondary-700/70 transition-colors"
            >
              <CloseIcon size={18} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
};
