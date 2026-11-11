import { Button, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Spinner } from '@filigran/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatConversationSummary, ChatMode, ChatPanelMode, Translate, XtmAgent } from '../types';
import { groupAgents, timeAgo, translate } from '../utils';
import { AgentIconGlyph } from './AgentIconGlyph';
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
import { ChatIconButton } from './ChatIconButton';
import { ClearAllConversations } from './ClearAllConversations';
import { ConversationListFailed } from './ConversationListFailed';
import { Dropdown } from './Dropdown';
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
  /** The history button opens the panel's conversation drawer instead of its menu (docked and floating). */
  historyAsDrawer?: boolean;
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

/** An agent's own icon when it has one the panel or the host can draw, the panel's logo otherwise. */
const AgentIcon = ({ icon, fallback, size = 16 }: { icon: string | null | undefined; fallback: React.ReactNode; size?: number }) => (
  <AgentIconGlyph
    icon={icon}
    size={size}
    fallback={<span className="text-[var(--chat-accent)] [&>svg]:w-4 [&>svg]:h-4">{fallback}</span>}
    imageClassName="w-4 h-4 chat-radius-sm object-cover"
    emojiClassName="text-sm leading-none"
  />
);

// Labels are thunks rather than bare strings so each key stays a literal call
// on the host's translator in the source: a table of plain keys resolved later
// through a variable works at runtime but is invisible to key extraction, which
// is how a locale ends up missing exactly the strings nobody typed by hand.
const modeOptions: { mode: ChatMode; label: (t: Translate) => string; getIcon: (p: { size: number; className: string }) => React.ReactNode }[] = [
  { mode: 'floating', label: (t) => t('Floating'), getIcon: (p) => <FloatingIcon {...p} /> },
  { mode: 'sidebar', label: (t) => t('Sidebar'), getIcon: (p) => <SidebarIcon {...p} /> },
  { mode: 'fullscreen', label: (t) => t('Full screen'), getIcon: (p) => <FullscreenIcon {...p} /> },
];

// The footer actions of the panel's own menus (the agent switcher, the history)
// are the design system's tertiary Button, full width and start aligned: those
// menus hold a search field and two-action rows, which the DS Menu cannot.
const footerAction = 'w-full justify-start';

/**
 * The switcher's "Open agent page" item: the address followed in place, unless
 * the host takes a plain click itself (`onClick`); a click with a modifier key
 * opens the address as the browser does. The menu closes either way.
 */
const AgentPageItem = ({ link, onDone, t }: { link: { href?: string; onClick?: () => void }; onDone: () => void; t: Translate }) => {
  if (!link.href) {
    return (
      <Button
        priority="tertiary"
        size="sm"
        startIcon={<BotIcon size={16} />}
        onClick={() => {
          onDone();
          link.onClick?.();
        }}
        className={footerAction}
      >
        {t('Open agent page')}
      </Button>
    );
  }
  return (
    <Button asChild priority="tertiary" size="sm" className={footerAction}>
      <a
        href={link.href}
        data-testid="filigran-chat-agent-page-link"
        onClick={(e) => {
          onDone();
          if (!link.onClick || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          link.onClick();
        }}
      >
        <BotIcon size={16} className="shrink-0" />
        {t('Open agent page')}
      </a>
    </Button>
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
  historyAsDrawer = false,
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

  // Closing the menu from inside it (Escape, an agent chosen) hands the focus
  // back to the trigger, so a keyboard user carries on from where they opened
  // it instead of landing on the page body. A click outside leaves the focus
  // where that click put it. The focus moves once the key's own dispatch and
  // the re-render it starts are over, never from inside the handler: moving it
  // there blurs the search field while React is still handling its keydown.
  const focusTriggerLater = () => {
    setTimeout(() => agentAnchorRef.current?.focus(), 0);
  };
  const closeAgentMenuToTrigger = () => {
    onAgentMenuClose();
    focusTriggerLater();
  };
  const switchAgentFromMenu = (agent: XtmAgent) => {
    onSwitchAgent(agent);
    focusTriggerLater();
  };

  const onAgentSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes the whole menu rather than only clearing the query, the
    // same key the rest of the panel uses to dismiss.
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAgentMenuToTrigger();
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
      if (agent) switchAgentFromMenu(agent);
    }
  };

  // Searchable as soon as there is a list: typing is the quickest way to an agent.
  const showAgentSearch = agents.length > 0;

  const CurrentModeIcon = mode === 'sidebar' ? SidebarIcon : mode === 'fullscreen' ? FullscreenExitIcon : FloatingIcon;

  return (
    <div
      className={`flex items-center px-3 py-2 min-h-[48px] border-b chat-border-200/10 chat-header-surface ${mode === 'floating' ? 'chat-radius-t-md' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          {/* One control: icon, name and chevron all open the switcher. The
              agent's page is an item of the menu, never this click. */}
          <Tooltip title={agentMenuOpen ? '' : t('Switch to another agent')} className="inline-flex min-w-0 max-w-full">
          <button
            data-ds-exempt="agent-switcher-combobox-trigger"
            ref={agentAnchorRef}
            type="button"
            onClick={onAgentMenuToggle}
            aria-haspopup="listbox"
            aria-expanded={agentMenuOpen}
            data-testid="filigran-chat-agent-switcher"
            className={`flex h-8 max-w-full min-w-0 items-center gap-1.5 text-sm font-semibold chat-text-900/100 pl-2 pr-1.5 chat-radius-sm border border-transparent hover:chat-surface-hover-100/10 hover:chat-border-200/10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--chat-accent)] transition-colors ${
              agentMenuOpen ? 'chat-surface-hover-100/10 chat-border-200/10' : ''
            }`}
          >
            <span className="flex shrink-0 items-center text-[var(--chat-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">
              {/* The current agent's own icon when it has one drawable, the panel's logo otherwise. */}
              <AgentIconGlyph
                icon={selectedAgent?.icon}
                size={18}
                fallback={logoIcon}
                imageClassName="w-[18px] h-[18px] chat-radius-sm object-cover"
                emojiClassName="text-base leading-none"
              />
            </span>
            <span className="min-w-0 truncate">{agentName}</span>
            <ChevronDownIcon
              size={16}
              className={`shrink-0 chat-text-muted-400/40 transition-transform ${agentMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          </Tooltip>
          {title && (
            <>
              <span aria-hidden className="shrink-0 chat-text-muted-400/30">
                /
              </span>
              <span data-testid="filigran-chat-header-title" className="min-w-0 truncate px-1 text-content-base chat-text-secondary-700/70">
                {title}
              </span>
            </>
          )}
        </div>
        {transferredFrom && (
          <div className="pl-10 pr-2 text-content-compact font-normal chat-text-muted-400/30">
            {translate(t, 'Transferred from {agent}', { agent: transferredFrom })}
          </div>
        )}
        {subtitle && (
          <div data-testid="filigran-chat-header-subtitle" className="truncate pl-10 pr-2 text-content-compact font-normal chat-text-muted-400/40">
            {subtitle}
          </div>
        )}
      </div>

      <Dropdown open={agentMenuOpen} onClose={onAgentMenuClose} anchorRef={agentAnchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-content-compact tracking-[1px] uppercase chat-text-muted-400/40">{t('Switch to another agent')}</span>
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
            <Spinner size="sm" />
          </div>
        )}
        {agents.length === 0 && !agentsLoading && agentsError && (
          <div className="px-4 py-3 flex items-start gap-2">
            <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-[var(--chat-warning)]" />
            <span className="text-content-compact leading-5 chat-text-secondary-600/60">
              {t('Could not reach the assistant service. Check the connection and try again.')}
            </span>
          </div>
        )}
        {agents.length === 0 && !agentsLoading && !agentsError && (
          <div className="px-4 py-3 text-content-compact chat-text-muted-400/40">{t('Agent switching is not available here')}</div>
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
                className="w-full h-7 pl-7 pr-2 chat-radius-sm chat-surface-subtle-100/6 text-content-compact chat-text-900/100 placeholder:chat-text-muted-400/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
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
            <div className="px-4 py-3 text-content-compact chat-text-muted-400/40">{t('No agent matches')}</div>
          )}
          {agentGroups.map(({ group, agents: groupMembers }) => (
            <div key={group ?? ''} role="group" aria-label={group ?? undefined}>
              {group && (
                <span className="block px-4 pt-2 pb-0.5 text-content-compact font-medium uppercase tracking-wide chat-text-muted-400/40">{group}</span>
              )}
              {groupMembers.map((agent) => {
                const index = orderedAgents.indexOf(agent);
                const isCurrent = agent.id === selectedAgent?.id;
                const isActive = index === activeAgentIndex;
                return (
                <button
                  data-ds-exempt="agent-listbox-option"
                  key={agent.id}
                  id={`filigran-chat-agent-option-${agent.id}`}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  data-active={isActive ? 'true' : undefined}
                  tabIndex={-1}
                  onClick={() => switchAgentFromMenu(agent)}
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
                      <span className="text-content-base font-medium chat-text-900/100 truncate">{agent.name}</span>
                      {agent.badges?.map((badge) => (
                        <span
                          key={badge}
                          className="shrink-0 chat-radius-sm bg-[var(--chat-accent)]/10 px-1 text-content-compact leading-4 text-[var(--chat-accent)]"
                        >
                          {badge}
                        </span>
                      ))}
                      {agent.disableChat && (
                        <span className="shrink-0 chat-radius-sm bg-[var(--chat-warning)]/10 px-1 text-content-compact leading-4 text-[var(--chat-warning)]">
                          {t('Not recommended for chat')}
                        </span>
                      )}
                    </div>
                    {agent.description && <div className="text-content-compact chat-text-secondary-500/40 truncate">{agent.description}</div>}
                  </div>
                  {isCurrent && <CheckIcon size={14} className="ml-auto shrink-0 text-[var(--chat-accent)]" />}
                </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="h-px chat-border-fill-200/10 mx-2" />
        <div className="flex flex-col p-1">
          {agentLink && <AgentPageItem link={agentLink} onDone={onAgentMenuClose} t={t} />}
          {agentDashboardUrl && (
            <Button
              priority="tertiary"
              size="sm"
              startIcon={<ExternalLinkIcon size={16} />}
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents`, '_blank');
              }}
              className={footerAction}
            >
              {t('Browse agents')}
            </Button>
          )}
          {agentDashboardUrl && (
            <Button
              priority="tertiary"
              size="sm"
              startIcon={<UserPlusIcon size={16} />}
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents/new`, '_blank');
              }}
              className={footerAction}
            >
              {t('Create agent')}
            </Button>
          )}
        </div>
      </Dropdown>

      <div className="flex-1" />

      {historyEnabled && (
        <>
          <ChatIconButton
            ref={historyAnchorRef}
            label={t('Conversation history')}
            icon={<HistoryIcon size={20} />}
            onClick={onHistoryMenuToggle}
            aria-haspopup={historyAsDrawer ? 'dialog' : 'menu'}
            aria-expanded={historyMenuOpen}
            active={historyMenuOpen}
          />

          <Dropdown open={historyMenuOpen && !historyAsDrawer} onClose={() => onHistoryMenuClose?.()} anchorRef={historyAnchorRef} placement="bottom-end" width={300}>
            <span className="block px-4 pt-3 pb-1 text-content-compact tracking-[1px] uppercase chat-text-muted-400/40">{t('Conversation history')}</span>
            <div className="max-h-72 overflow-y-auto filigran-chat-scrollable">
              {conversationsLoading && conversations.length === 0 && (
                <div className="px-4 py-2">
                  <Spinner size="sm" />
                </div>
              )}
              {!conversationsLoading &&
                conversations.length === 0 &&
                (conversationsFailed ? (
                  <ConversationListFailed onRetry={() => onRetryConversations?.()} className="px-4 py-3" t={t} />
                ) : (
                  <div className="px-4 py-3 text-content-compact chat-text-muted-400/40">{t('No conversations yet')}</div>
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
                    <button
                      data-ds-exempt="history-two-action-row"
                      type="button"
                      onClick={() => onSelectConversation?.(conv.conversationId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-content-base font-medium chat-text-900/100 truncate">{conv.title || t('Untitled conversation')}</div>
                      {when && <div className="text-content-compact chat-text-muted-500/40 truncate">{when}</div>}
                    </button>
                    {onDeleteConversation && (
                      <ChatIconButton
                        label={t('Delete conversation')}
                        icon={<TrashIcon size={16} />}
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteConversation(conv.conversationId)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-px chat-border-fill-200/10 mx-2" />
            <div className="p-1">
              <Button
                priority="tertiary"
                size="sm"
                startIcon={<EditIcon size={16} />}
                onClick={() => {
                  onHistoryMenuClose?.();
                  onNewChat();
                }}
                className={footerAction}
              >
                {t('New conversation')}
              </Button>
            </div>
            {onClearAll && conversations.length > 0 && (
              <ClearAllConversations
                onClear={() => {
                  onHistoryMenuClose?.();
                  onClearAll();
                }}
                action={clearAllAction}
                className="px-3 pb-2"
                t={t}
              />
            )}
          </Dropdown>
        </>
      )}

      {actions}

      <ChatIconButton label={t('New chat')} icon={<EditIcon size={20} />} onClick={onNewChat} />

      {mode !== 'inline' && onModeChange && (
        // The design system's Menu, kept inside the panel's stacking context
        // (portalled={false}) and non-modal: the host page stays live beside the panel.
        <Menu open={modeMenuOpen} onOpenChange={(open) => (open ? onModeMenuToggle() : onModeMenuClose())} modal={false}>
          <MenuTrigger asChild>
            <ChatIconButton
              ref={modeAnchorRef}
              label={t('Switch view')}
              icon={<CurrentModeIcon size={20} />}
              active={modeMenuOpen}
            />
          </MenuTrigger>
          <MenuContent portalled={false} align="end" className="z-[10000]">
            <MenuLabel>{t('Switch to')}</MenuLabel>
            {modeOptions.map((opt) => (
              <MenuItem
                key={opt.mode}
                startIcon={opt.getIcon({ size: 16, className: '' })}
                selected={mode === opt.mode}
                onSelect={() => onModeChange(opt.mode)}
              >
                {opt.label(t)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
      {mode !== 'inline' && onClose && (
        <>
          <ChatIconButton label={t('Close')} icon={<CloseIcon size={20} />} onClick={onClose} />
        </>
      )}
    </div>
  );
};
