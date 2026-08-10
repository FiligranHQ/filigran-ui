import { useMemo, useRef, useState } from 'react';
import type { ChatConversationSummary } from '../types';
import { timeAgo } from '../utils';
import { BotIcon, EditIcon, SearchIcon, SidebarIcon, TrashIcon } from './icons';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

interface ConversationSidebarProps {
  conversations: ChatConversationSummary[];
  loading: boolean;
  activeConversationId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Omit to hide the rename affordance (backend without the route). */
  onRename?: (id: string, title: string) => void;
  onNewChat: () => void;
  t: (key: string) => string;
}

/** Below this many conversations the list is quicker to scan than to filter. */
const SEARCH_THRESHOLD = 7;

/**
 * Persistent conversation list for fullscreen mode, mirroring the XTM One web
 * chat's sidebar.
 *
 * Fullscreen is the only mode with room for it: in floating and sidebar modes
 * the header's history menu remains the way in, since a permanent column there
 * would eat most of the panel.
 */
export const ConversationSidebar = ({
  conversations,
  loading,
  activeConversationId,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onDelete,
  onRename,
  onNewChat,
  t,
}: ConversationSidebarProps) => {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  // Guards the input's onBlur: committing and then blurring would fire the
  // commit twice, and cancelling via Escape blurs too.
  const settledRef = useRef(false);

  const startRename = (id: string, current: string) => {
    settledRef.current = false;
    setEditingId(id);
    setDraftTitle(current);
  };

  const commitRename = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const id = editingId;
    const next = draftTitle.trim();
    setEditingId(null);
    // Unchanged or emptied: leave the conversation alone rather than issuing a
    // request that would either no-op or wipe the title.
    if (id && next) onRename?.(id, next);
  };

  const cancelRename = () => {
    settledRef.current = true;
    setEditingId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, query]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 border-r border-gray-200 dark:border-white/10 px-2 py-3 shrink-0">
        <Tooltip title={t('Show conversations')}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t('Show conversations')}
            aria-expanded={false}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <SidebarIcon size={17} />
          </button>
        </Tooltip>
        <Tooltip title={t('New conversation')}>
          <button
            type="button"
            onClick={onNewChat}
            aria-label={t('New conversation')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <EditIcon size={17} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-white/10">
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-[0.8125rem] text-gray-700 dark:text-white/70 hover:border-[var(--chat-accent)]/40 hover:text-[var(--chat-accent)] transition-colors"
        >
          <EditIcon size={15} />
          {t('New conversation')}
        </button>
        <Tooltip title={t('Hide conversations')}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t('Hide conversations')}
            aria-expanded
            className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <SidebarIcon size={17} />
          </button>
        </Tooltip>
      </div>

      {conversations.length > SEARCH_THRESHOLD && (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
              placeholder={t('Search conversations...')}
              aria-label={t('Search conversations...')}
              className="w-full h-7 pl-7 pr-2 rounded-md bg-gray-100 dark:bg-white/[0.06] text-[0.75rem] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-3 filigran-chat-scrollable">
        {loading && conversations.length === 0 && (
          <div className="px-3 py-2">
            <Spinner size={16} />
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-3 py-2 text-[0.75rem] text-gray-400 dark:text-white/40">{t('No conversations yet')}</p>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <p className="px-3 py-2 text-[0.75rem] text-gray-400 dark:text-white/40">{t('No conversation matches')}</p>
        )}

        {filtered.map((c) => {
          const isActive = c.conversationId === activeConversationId;
          const isEditing = c.conversationId === editingId;
          return (
            <div
              key={c.conversationId}
              role="button"
              tabIndex={0}
              aria-current={isActive}
              onClick={() => onSelect(c.conversationId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(c.conversationId);
                }
              }}
              className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left cursor-pointer transition-colors ${
                isActive ? 'bg-[var(--chat-accent)]/10' : 'hover:bg-gray-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? 'bg-[var(--chat-accent)]/20 text-[var(--chat-accent)]' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/30'
                }`}
              >
                <BotIcon size={13} />
              </span>
              <span className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    // The row selects on click and on Enter/Space; while editing
                    // those belong to the field, not to navigation.
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={commitRename}
                    aria-label={t('Conversation title')}
                    className="w-full rounded-md bg-white dark:bg-white/10 px-1.5 py-0.5 text-[0.8125rem] text-gray-900 dark:text-white outline-hidden ring-1 ring-[var(--chat-accent)]"
                  />
                ) : (
                  <span className={`block truncate text-[0.8125rem] ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-white/70'}`}>
                    {c.title || t('Untitled conversation')}
                  </span>
                )}
                {c.updatedAt && !isEditing && (
                  <span className="block text-[0.65rem] text-gray-400 dark:text-white/30">{timeAgo(c.updatedAt, t)}</span>
                )}
              </span>
              {!isEditing && (
                <span className="flex shrink-0 self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(c.conversationId, c.title || '');
                      }}
                      aria-label={t('Rename conversation')}
                      title={t('Rename conversation')}
                      className="p-1 rounded-md text-gray-400 dark:text-white/30 hover:text-[var(--chat-accent)]"
                    >
                      <EditIcon size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      // The row is the click target for selection, so deleting
                      // must not also open the conversation on its way out.
                      e.stopPropagation();
                      onDelete(c.conversationId);
                    }}
                    aria-label={t('Delete conversation')}
                    title={t('Delete conversation')}
                    className="p-1 rounded-md text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <TrashIcon size={13} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
