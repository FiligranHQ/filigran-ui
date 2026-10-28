import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { ChatConversationSummary, ChatWorkspace } from '../types';
import type { WorkspaceWriteResult } from '../hooks/useWorkspaces';
import { timeAgo } from '../utils';
import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from '../utils/storage';
import { fileableWorkspaces, groupCanToggle, groupConversations, groupIsOpen, isNoopMove, unfiledEmptyNote } from '../utils/workspaces';
import { ClearAllConversations } from './ClearAllConversations';
import { Dropdown } from './Dropdown';
import {
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  PencilIcon,
  SearchIcon,
  SidebarIcon,
  TrashIcon,
} from './icons';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

/**
 * The workspaces the list is grouped by, and what the list may do with them.
 * Omitted when the host does not name `apiEndpoints.workspaces` or the backend
 * refuses the list: the sidebar is then the flat list it always was.
 */
export interface SidebarWorkspaces {
  list: ChatWorkspace[];
  /** The workspace the next conversation will be created in, if any. */
  pendingWorkspaceId: string | null;
  onCreate: (name: string) => Promise<WorkspaceWriteResult>;
  onRename: (id: string, name: string) => Promise<WorkspaceWriteResult>;
  onDelete: (id: string) => Promise<WorkspaceWriteResult>;
  /** Resolves to `null` on success, or the backend's reason. */
  onMove: (conversationId: string, workspaceId: string | null) => Promise<string | null>;
  onNewChat: (workspaceId: string) => void;
}

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
  workspaces?: SidebarWorkspaces;
  /** Namespace of the browser-storage keys (see `storageKeyPrefix` on the panel). */
  storageKeyPrefix?: string;
  /** The host's controls on a row, before rename and delete. */
  rowActions?: (conversation: ChatConversationSummary) => ReactNode;
  /** The host's controls beside New conversation. */
  headerActions?: ReactNode;
  /** The host's sections under the list. */
  sections?: ReactNode;
  /** Deletes every conversation, after a confirmation; omitted when the host offers no route. */
  onClearAll?: () => void;
  t: (key: string) => string;
}

/** Below this many conversations the list is quicker to scan than to filter. */
const SEARCH_THRESHOLD = 7;
/** What a dragged conversation row carries. */
const DRAG_TYPE = 'application/x-filigran-conversation';
function readCollapsed(key: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readStorage('local', key) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

const iconButton = 'p-1 rounded-md chat-text-muted-400/30 hover:chat-icon-hover transition-colors disabled:opacity-40 disabled:pointer-events-none';
const sectionLabel = 'text-[0.625rem] font-medium uppercase tracking-wide chat-text-muted-400/40';

/**
 * Persistent conversation list for fullscreen mode, mirroring the XTM One web
 * chat's sidebar - grouped by workspace when the host offers workspaces, the
 * way a desktop assistant groups its projects: collapsible groups, a
 * conversation started inside one, and rows moved between them from their
 * menu or by dragging them onto a group.
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
  workspaces,
  storageKeyPrefix,
  rowActions,
  headerActions,
  sections,
  onClearAll,
  t,
}: ConversationSidebarProps) => {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  // Guards the input's onBlur: committing and then blurring would fire the
  // commit twice, and cancelling via Escape blurs too.
  const settledRef = useRef(false);
  // Where the collapsed workspace groups are remembered, per browser.
  const collapsedKey = storageKey(storageKeyPrefix, STORAGE_KEYS.collapsedWorkspaces);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => readCollapsed(collapsedKey));
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A refusal is said, then goes: it is about the action just tried.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

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

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeStorage('local', collapsedKey, JSON.stringify([...next]));
      return next;
    });
  };

  const say = (reason: string | null, fallback: string) => setError(reason || t(fallback));

  const move = async (conversationId: string, workspaceId: string | null) => {
    // A drop on the group the row is already in (or an unfiled row on "Not in
    // a workspace") is no move: the row menu disables it, the drop ignores it.
    if (!workspaces || isNoopMove(conversations, conversationId, workspaceId)) return;
    const refusal = await workspaces.onMove(conversationId, workspaceId);
    if (refusal !== null) say(refusal, 'The conversation could not be moved');
  };

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? (c: ChatConversationSummary) => (c.title || '').toLowerCase().includes(q) : undefined), [q]);
  const filtered = useMemo(() => (matches ? conversations.filter(matches) : conversations), [conversations, matches]);
  const grouped = useMemo(
    () => (workspaces ? groupConversations(conversations, workspaces.list, { matches }) : null),
    [conversations, workspaces, matches],
  );
  const fileable = workspaces ? fileableWorkspaces(workspaces.list) : [];
  const unfiledNote = grouped ? unfiledEmptyNote({ total: conversations.length, unfiled: grouped.unfiled.length, loading, searching: !!q }) : null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 border-r chat-border-200/10 px-2 py-3 shrink-0">
        <Tooltip title={t('Show conversations')}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t('Show conversations')}
            aria-expanded={false}
            className="w-8 h-8 flex items-center justify-center rounded-lg chat-text-muted-400/30 hover:chat-surface-hover-100/10 transition-colors"
          >
            <SidebarIcon size={17} />
          </button>
        </Tooltip>
        <Tooltip title={t('New conversation')}>
          <button
            type="button"
            onClick={() => onNewChat()}
            aria-label={t('New conversation')}
            className="w-8 h-8 flex items-center justify-center rounded-lg chat-text-muted-400/30 hover:chat-surface-hover-100/10 transition-colors"
          >
            <EditIcon size={17} />
          </button>
        </Tooltip>
      </div>
    );
  }

  const renderRow = (c: ChatConversationSummary) => (
    <ConversationRow
      key={c.conversationId}
      conversation={c}
      isActive={c.conversationId === activeConversationId}
      isEditing={c.conversationId === editingId}
      draftTitle={draftTitle}
      onDraftTitleChange={setDraftTitle}
      onCommitRename={commitRename}
      onCancelRename={cancelRename}
      onStartRename={onRename ? startRename : undefined}
      onSelect={onSelect}
      onDelete={onDelete}
      fileable={workspaces ? fileable : undefined}
      onMove={move}
      actions={rowActions}
      t={t}
    />
  );

  return (
    <div className="w-64 shrink-0 flex flex-col border-r chat-border-200/10">
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          type="button"
          onClick={() => onNewChat()}
          className="flex-1 flex items-center gap-2 rounded-lg border chat-border-200/10 px-3 py-1.5 text-[0.8125rem] chat-text-secondary-700/70 hover:border-[var(--chat-accent)]/40 hover:text-[var(--chat-accent)] transition-colors"
        >
          <EditIcon size={15} />
          {t('New conversation')}
        </button>
        {headerActions}
        <Tooltip title={t('Hide conversations')}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t('Hide conversations')}
            aria-expanded
            className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg chat-text-muted-400/30 hover:chat-surface-hover-100/10 transition-colors"
          >
            <SidebarIcon size={17} />
          </button>
        </Tooltip>
      </div>

      {conversations.length > SEARCH_THRESHOLD && (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 chat-text-muted-400/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
              placeholder={t('Search conversations...')}
              aria-label={t('Search conversations...')}
              className="w-full h-7 pl-7 pr-2 rounded-md chat-surface-subtle-100/6 text-[0.75rem] chat-text-900/100 placeholder:chat-text-muted-400/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
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

        {grouped && workspaces ? (
          <>
            {!q && (
              <div className="flex items-center justify-between px-2 pb-1 pt-1">
                <span className={sectionLabel}>{t('Workspaces')}</span>
                <Tooltip title={t('New workspace')}>
                  <button type="button" onClick={() => setCreatingWorkspace(true)} aria-label={t('New workspace')} className={iconButton}>
                    <FolderPlusIcon size={14} />
                  </button>
                </Tooltip>
              </div>
            )}
            {creatingWorkspace && (
              <NameField
                placeholder={t('Workspace name')}
                onSubmit={async (name) => {
                  setCreatingWorkspace(false);
                  if (!name) return;
                  const result = await workspaces.onCreate(name);
                  if (!result.ok) say(result.error, 'The workspace could not be created');
                }}
                onCancel={() => setCreatingWorkspace(false)}
              />
            )}
            {grouped.groups.map((group) => (
              <WorkspaceGroupSection
                key={group.key}
                workspace={group.workspace}
                count={group.conversations.length}
                open={groupIsOpen(group.key, collapsedGroups, group, activeConversationId, !!q)}
                toggleable={groupCanToggle(group, activeConversationId, !!q)}
                pending={!!group.workspace && workspaces.pendingWorkspaceId === group.workspace.id && !activeConversationId}
                onToggle={() => toggleGroup(group.key)}
                onNewChat={workspaces.onNewChat}
                onRename={async (id, name) => {
                  const result = await workspaces.onRename(id, name);
                  if (!result.ok) say(result.error, 'The workspace could not be renamed');
                }}
                onDelete={async (id) => {
                  const result = await workspaces.onDelete(id);
                  if (!result.ok) say(result.error, 'The workspace could not be deleted');
                }}
                onDropConversation={(conversationId) => group.workspace && void move(conversationId, group.workspace.id)}
                t={t}
              >
                {group.conversations.length > 0 ? (
                  group.conversations.map(renderRow)
                ) : (
                  <p className="px-3 py-1.5 text-[0.65rem] chat-text-muted-400/30">
                    {/* The glyph is the workspace's own New conversation button. */}
                    {t('Drop a conversation here, or start one with {icon}.')
                      .split('{icon}')
                      .flatMap((part, i) => (i === 0 ? [part] : [<EditIcon key={i} size={11} className="inline align-[-1px]" />, part]))}
                  </p>
                )}
              </WorkspaceGroupSection>
            ))}
            <DropZone onDropConversation={(conversationId) => void move(conversationId, null)} accepts>
              <div className="flex items-center justify-between px-2 pb-1 pt-3">
                <span className={sectionLabel}>{t('Not in a workspace')}</span>
                <span className="text-[0.625rem] tabular-nums chat-text-muted-400/30">{grouped.unfiled.length}</span>
              </div>
              {grouped.unfiled.map(renderRow)}
              {unfiledNote && (
                <p className="px-3 py-1.5 text-[0.65rem] chat-text-muted-400/30">
                  {unfiledNote === 'none' ? t('No conversations yet') : t('Every conversation is in a workspace.')}
                </p>
              )}
            </DropZone>
            {q && grouped.groups.length === 0 && grouped.unfiled.length === 0 && (
              <p className="px-3 py-2 text-[0.75rem] chat-text-muted-400/40">{t('No conversation matches')}</p>
            )}
          </>
        ) : (
          <>
            {!loading && conversations.length === 0 && <p className="px-3 py-2 text-[0.75rem] chat-text-muted-400/40">{t('No conversations yet')}</p>}
            {conversations.length > 0 && filtered.length === 0 && (
              <p className="px-3 py-2 text-[0.75rem] chat-text-muted-400/40">{t('No conversation matches')}</p>
            )}
            {filtered.map(renderRow)}
          </>
        )}
        {sections}
        {onClearAll && conversations.length > 0 && !q && (
          <ClearAllConversations onClear={onClearAll} className="px-2 pt-3" iconButtonClass={iconButton} t={t} />
        )}
      </div>

      {error && (
        <p role="alert" className="mx-3 mb-3 rounded-md bg-red-500/10 px-2.5 py-1.5 text-[0.7rem] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

/** An element conversations can be dropped onto. */
const DropZone = ({
  onDropConversation,
  accepts,
  children,
  className = '',
}: {
  onDropConversation: (conversationId: string) => void;
  accepts: boolean;
  children: ReactNode;
  className?: string;
}) => {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const carries = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <div
      className={`rounded-lg transition-colors ${over ? 'bg-[var(--chat-accent)]/10 ring-1 ring-[var(--chat-accent)]/40' : ''} ${className}`}
      {...(accepts
        ? {
            onDragEnter: (e: DragEvent) => {
              if (!carries(e)) return;
              depth.current += 1;
              setOver(true);
            },
            onDragOver: (e: DragEvent) => {
              if (!carries(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            },
            onDragLeave: (e: DragEvent) => {
              if (!carries(e)) return;
              depth.current = Math.max(0, depth.current - 1);
              if (depth.current === 0) setOver(false);
            },
            onDrop: (e: DragEvent) => {
              if (!carries(e)) return;
              e.preventDefault();
              depth.current = 0;
              setOver(false);
              const id = e.dataTransfer.getData(DRAG_TYPE);
              if (id) onDropConversation(id);
            },
          }
        : {})}
    >
      {children}
    </div>
  );
};

/** A one-line name field: Enter commits, Escape or an empty blur cancels. */
const NameField = ({
  initial = '',
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    onSubmit(value.trim());
  };
  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          settled.current = true;
          onCancel();
        }
      }}
      onBlur={commit}
      placeholder={placeholder}
      aria-label={placeholder}
      className="mx-2 mb-1 w-[calc(100%-1rem)] rounded-md chat-input-surface-white/10 px-2 py-1 text-[0.8125rem] chat-text-900/100 outline-hidden ring-1 ring-[var(--chat-accent)]"
    />
  );
};

const WorkspaceGroupSection = ({
  workspace,
  count,
  open,
  toggleable,
  pending,
  onToggle,
  onNewChat,
  onRename,
  onDelete,
  onDropConversation,
  t,
  children,
}: {
  /** `null` for the conversations filed where the list does not reach. */
  workspace: ChatWorkspace | null;
  count: number;
  open: boolean;
  /** False while the group is held open (a search, the conversation on screen). */
  toggleable: boolean;
  /** A new conversation is about to be created in this workspace. */
  pending: boolean;
  onToggle: () => void;
  onNewChat: (workspaceId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDropConversation: (conversationId: string) => void;
  t: (key: string) => string;
  children: ReactNode;
}) => {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const manageable = !!workspace?.canManage;
  const isMyDefault = !!workspace && workspace.isDefault && workspace.isOwn;

  return (
    <DropZone onDropConversation={onDropConversation} accepts={manageable} className="mb-0.5">
      <div className="group/ws flex items-center gap-1 rounded-lg px-1.5 py-1 hover:chat-surface-hover-100/6">
        {renaming && workspace ? (
          <NameField
            initial={workspace.name}
            placeholder={t('Workspace name')}
            onSubmit={(name) => {
              setRenaming(false);
              if (name && name !== workspace.name) onRename(workspace.id, name);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={!toggleable}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
          >
            <ChevronRightIcon size={12} className={`shrink-0 chat-text-muted-400/30 transition-transform ${open ? 'rotate-90' : ''}`} />
            <FolderIcon size={14} className="shrink-0 text-[var(--chat-accent)]" />
            <span className="truncate text-[0.8125rem] font-medium chat-text-800/80">{workspace ? workspace.name : t('Other workspaces')}</span>
            {isMyDefault && (
              <span className="shrink-0 rounded bg-[var(--chat-accent)]/10 px-1 text-[0.6rem] text-[var(--chat-accent)]">{t('default')}</span>
            )}
            <span className="ml-auto shrink-0 pr-1 text-[0.625rem] tabular-nums chat-text-muted-400/30">{count}</span>
          </button>
        )}
        {workspace && manageable && !renaming && (
          <span className="flex shrink-0 items-center opacity-0 group-hover/ws:opacity-100 focus-within:opacity-100 transition-opacity">
            {confirmingDelete ? (
              <>
                <span className="px-1 text-[0.65rem] text-red-600 dark:text-red-400">{t('Delete?')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(workspace.id);
                  }}
                  aria-label={t('Delete workspace')}
                  className={`${iconButton} hover:text-red-500`}
                >
                  <CheckIcon size={13} />
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} aria-label={t('Cancel')} className={iconButton}>
                  <CloseIcon size={13} />
                </button>
              </>
            ) : (
              <>
                <Tooltip title={t('New conversation in this workspace')}>
                  <button
                    type="button"
                    onClick={() => onNewChat(workspace.id)}
                    aria-label={t('New conversation in this workspace')}
                    className={iconButton}
                  >
                    <EditIcon size={13} />
                  </button>
                </Tooltip>
                <Tooltip title={t('Rename workspace')}>
                  <button type="button" onClick={() => setRenaming(true)} aria-label={t('Rename workspace')} className={iconButton}>
                    <PencilIcon size={13} />
                  </button>
                </Tooltip>
                {/* The default cannot be deleted: every person keeps one. */}
                {!workspace.isDefault && (
                  <Tooltip title={t('Delete workspace')}>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      aria-label={t('Delete workspace')}
                      className={`${iconButton} hover:text-red-500`}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </Tooltip>
                )}
              </>
            )}
          </span>
        )}
      </div>
      {open && (
        <div className="space-y-0.5 pb-1 pl-3">
          {pending && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--chat-accent)]/10 px-2.5 py-1.5 text-[0.75rem] text-[var(--chat-accent)]">
              <EditIcon size={12} />
              {t('New conversation — send a message to start it')}
            </div>
          )}
          {children}
        </div>
      )}
    </DropZone>
  );
};

const ConversationRow = ({
  conversation: c,
  isActive,
  isEditing,
  draftTitle,
  onDraftTitleChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onSelect,
  onDelete,
  fileable,
  onMove,
  actions,
  t,
}: {
  conversation: ChatConversationSummary;
  isActive: boolean;
  isEditing: boolean;
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename?: (id: string, current: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Workspaces the row can be moved into; omitted when there are no workspaces. */
  fileable?: ChatWorkspace[];
  onMove: (conversationId: string, workspaceId: string | null) => void;
  actions?: (conversation: ChatConversationSummary) => ReactNode;
  t: (key: string) => string;
}) => {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveAnchor = useRef<HTMLButtonElement>(null);
  const movable = !!fileable && !isEditing;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive}
      draggable={movable}
      onDragStart={
        movable
          ? (e) => {
              e.dataTransfer.setData(DRAG_TYPE, c.conversationId);
              e.dataTransfer.effectAllowed = 'move';
            }
          : undefined
      }
      onClick={() => onSelect(c.conversationId)}
      onKeyDown={(e) => {
        // Only the row's own keys: Enter or Space on the move, rename and
        // delete buttons inside it belongs to those buttons.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(c.conversationId);
        }
      }}
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left cursor-pointer transition-colors ${
        isActive ? 'bg-[var(--chat-accent)]/10' : 'hover:chat-surface-hover-100/6'
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
          isActive ? 'bg-[var(--chat-accent)]/20 text-[var(--chat-accent)]' : 'chat-surface-subtle-100/6 chat-text-muted-400/30'
        }`}
      >
        <BotIcon size={13} />
      </span>
      <span className="min-w-0 flex-1">
        {isEditing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => onDraftTitleChange(e.target.value)}
            // The row selects on click and on Enter/Space; while editing
            // those belong to the field, not to navigation.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={onCommitRename}
            aria-label={t('Conversation title')}
            className="w-full rounded-md chat-input-surface-white/10 px-1.5 py-0.5 text-[0.8125rem] chat-text-900/100 outline-hidden ring-1 ring-[var(--chat-accent)]"
          />
        ) : (
          <span className={`block truncate text-[0.8125rem] ${isActive ? 'chat-text-900/100' : 'chat-text-secondary-700/70'}`}>
            {c.title || t('Untitled conversation')}
          </span>
        )}
        {/*
          Agent before time, on one line: which agent a thread is with
          is what tells two similarly-titled conversations apart, and
          knowing it before opening one is the point. Omitted entirely
          when the backend does not report it, rather than padded with
          a placeholder.
        */}
        {(c.agentName || c.updatedAt) && !isEditing && (
          <span className="block text-[0.65rem] chat-text-muted-400/30 truncate">
            {c.agentName}
            {c.agentName && c.updatedAt ? ' · ' : ''}
            {c.updatedAt ? timeAgo(c.updatedAt, t) : ''}
          </span>
        )}
      </span>
      {!isEditing && (
        <span className="flex shrink-0 self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {actions && (
            // The row selects on click and on Enter/Space: the host's controls keep theirs.
            <span className="flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {actions(c)}
            </span>
          )}
          {movable && (
            <>
              <button
                ref={moveAnchor}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveOpen((v) => !v);
                }}
                aria-label={t('Move to workspace')}
                title={t('Move to workspace')}
                aria-expanded={moveOpen}
                className="p-1 rounded-md chat-text-muted-400/30 hover:text-[var(--chat-accent)]"
              >
                <FolderInputIcon size={13} />
              </button>
              <Dropdown open={moveOpen} onClose={() => setMoveOpen(false)} anchorRef={moveAnchor} placement="bottom-end" width={220}>
                <div className="py-1" onClick={(e) => e.stopPropagation()}>
                  <p className="px-3 pb-1 pt-1.5 text-[0.625rem] font-medium uppercase tracking-wide chat-text-muted-400/40">
                    {t('Move to workspace')}
                  </p>
                  {fileable.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      disabled={w.id === c.workspaceId}
                      onClick={() => {
                        setMoveOpen(false);
                        onMove(c.conversationId, w.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] chat-text-secondary-700/80 hover:chat-surface-hover-100/10 disabled:opacity-40"
                    >
                      <FolderIcon size={13} className="shrink-0 text-[var(--chat-accent)]" />
                      <span className="truncate">{w.name}</span>
                      {w.id === c.workspaceId && <CheckIcon size={12} className="ml-auto shrink-0" />}
                    </button>
                  ))}
                  <div className="my-1 h-px chat-border-fill-200/10" />
                  <button
                    type="button"
                    disabled={!c.workspaceId}
                    onClick={() => {
                      setMoveOpen(false);
                      onMove(c.conversationId, null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] chat-text-secondary-700/80 hover:chat-surface-hover-100/10 disabled:opacity-40"
                  >
                    <CloseIcon size={13} className="shrink-0" />
                    {t('Remove from workspace')}
                  </button>
                </div>
              </Dropdown>
            </>
          )}
          {onStartRename && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(c.conversationId, c.title || '');
              }}
              aria-label={t('Rename conversation')}
              title={t('Rename conversation')}
              className="p-1 rounded-md chat-text-muted-400/30 hover:text-[var(--chat-accent)]"
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
            className="p-1 rounded-md chat-text-muted-400/30 hover:text-red-500 dark:hover:text-red-400"
          >
            <TrashIcon size={13} />
          </button>
        </span>
      )}
    </div>
  );
};
