import { memo, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  SearchField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
} from '@filigran/design-system';
import type { ChatConversationSummary, ChatSidebarSearch, ChatWorkspace } from '../types';
import type { WorkspaceWriteResult } from '../hooks/useWorkspaces';
import { timeAgo, translate, translateAround } from '../utils';
import { AgentIconGlyph } from './AgentIconGlyph';
import { channelName, conversationMatches } from '../utils/conversationList';
import { groupByDate, rowTitle, showsSeveralAgents } from '../utils/dateGroups';
import { isComposing } from '../utils/keyboard';
import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from '../utils/storage';
import { LIST_WIDTH, listLayout } from '../utils/layout';
import { fileableWorkspaces, groupCanToggle, groupConversations, groupIsOpen, isNoopMove } from '../utils/workspaces';
import { ClearAllConversations } from './ClearAllConversations';
import { ConversationListFailed } from './ConversationListFailed';
import {
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  SidebarIcon,
  TrashIcon,
} from './icons';
import { ChatNotice } from './ChatNotice';
import { ChatIconButton } from './ChatIconButton';
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
  /** Files the conversation, saying itself what failed. */
  onMove: (conversationId: string, workspaceId: string | null) => Promise<void>;
  onNewChat: (workspaceId: string) => void;
}

interface ConversationSidebarProps {
  conversations: ChatConversationSummary[];
  loading: boolean;
  /** The last read of the list failed: with no conversations, the list says so instead of being empty. */
  failed?: boolean;
  /** Reads the list again, offered when it could not be read. */
  onRetry?: () => void;
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
  /**
   * The groups the user has opened, every other one collapsed (see
   * `expandedWorkspaceGroups` on the panel): held by the panel, which applies
   * each `onGroupOpenedChange` to the set it has then.
   */
  expandedGroups?: string[];
  onGroupOpenedChange?: (key: string, open: boolean) => void;
  /** The host's controls on a row, before rename and delete. */
  rowActions?: (conversation: ChatConversationSummary) => ReactNode;
  /** The host's controls beside New conversation. */
  headerActions?: ReactNode;
  /** The host's sections under the list; a function follows the search. */
  sections?: ReactNode | ((search: ChatSidebarSearch) => ReactNode);
  /** Deletes every conversation, after a confirmation; omitted when the host offers no route. */
  onClearAll?: () => void;
  /** What Clear all does, for its wording. */
  clearAllAction?: 'delete' | 'archive';
  /** The search box shows above this many conversations. */
  searchThreshold?: number;
  /** The host's names of the channels a conversation was started in (see `channelLabel` on the panel). */
  channelLabel?: (channel: string) => string | null | undefined;
  /**
   * The panel's width in px, once measured: the list never takes more than a
   * quarter of it nor leaves the conversation under 680 px, and folds to its
   * rail when even its minimum would.
   */
  panelWidth?: number | null;
  /**
   * Drawn as a drawer over a docked panel or a floating window (UX spec A): its
   * default width, a raised surface, no resize handle and no rail.
   */
  overlay?: boolean;
  /** The conversation whose answer is being written: its row ends with a spinner. */
  generatingConversationId?: string | null;
  /** What failed in the list, said under it. */
  notice?: string | null;
  /** Says what failed in the list (`notice` shows it). */
  onNotice?: (text: string) => void;
  t: (key: string) => string;
}

/** Below this many conversations the list is quicker to scan than to filter. */
const SEARCH_THRESHOLD = 7;

/** The workspace filter's values beside the workspace ids: every conversation, or the unfiled ones. */
export const WORKSPACE_FILTER = { all: '__all__', none: '__none__' } as const;

/** Whether a conversation passes the header's workspace filter. */
export function inWorkspaceFilter(conversation: ChatConversationSummary, filter: string): boolean {
  if (filter === WORKSPACE_FILTER.all) return true;
  if (filter === WORKSPACE_FILTER.none) return !conversation.workspaceId;
  return conversation.workspaceId === filter;
}

/**
 * A host's sections drawn from the search, as a component of their own: drawn
 * again only when the search or the function changes, not on each of the
 * list's own updates, and apart from the list's hooks.
 */
const HostSections = memo(function HostSections({ draw, query }: { draw: (search: ChatSidebarSearch) => ReactNode; query: string }) {
  return <>{draw({ query })}</>;
});
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

/**
 * The list's width in a page or full screen, in px (`utils/layout`): dragged
 * from its right edge between `min` and `max`, back to `default` on a
 * double-click, remembered per browser.
 */
export { LIST_WIDTH };
/** What an arrow key moves the list's edge by. */
const LIST_WIDTH_STEP = 16;

export function clampListWidth(width: number): number {
  return Math.round(Math.min(Math.max(width, LIST_WIDTH.min), LIST_WIDTH.max));
}

function readListWidth(key: string): number {
  const parsed = Number.parseInt(readStorage('local', key) ?? '', 10);
  return Number.isNaN(parsed) ? LIST_WIDTH.default : clampListWidth(parsed);
}

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
  failed = false,
  onRetry,
  activeConversationId,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onDelete,
  onRename,
  onNewChat,
  workspaces,
  storageKeyPrefix,
  expandedGroups,
  onGroupOpenedChange,
  rowActions,
  headerActions,
  sections,
  onClearAll,
  clearAllAction,
  searchThreshold = SEARCH_THRESHOLD,
  channelLabel,
  panelWidth = null,
  overlay = false,
  generatingConversationId = null,
  notice,
  onNotice,
  t,
}: ConversationSidebarProps) => {
  const [query, setQuery] = useState('');
  // The header's workspace filter (UX spec C): every workspace by default.
  const [workspaceFilter, setWorkspaceFilter] = useState<string>(WORKSPACE_FILTER.all);
  // Asked from the rail: once the list is open, its search box takes the focus.
  const [focusSearch, setFocusSearch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  // Guards the input's onBlur: committing and then blurring would fire the
  // commit twice, and cancelling via Escape blurs too.
  const settledRef = useRef(false);
  // Where the collapsed workspace groups are remembered, per browser.
  const collapsedKey = storageKey(storageKeyPrefix, STORAGE_KEYS.collapsedWorkspaces);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => readCollapsed(collapsedKey));
  // Or, where the host keeps them per user, the groups the user has opened.
  const openedGroups = useMemo(() => (expandedGroups ? new Set(expandedGroups) : null), [expandedGroups]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  // Conversations come first: the workspaces fold into one line above them,
  // opened on demand and remembered per browser.
  const workspacesOpenKey = storageKey(storageKeyPrefix, STORAGE_KEYS.workspacesOpen);
  const [workspacesShown, setWorkspacesShown] = useState(() => readStorage('local', workspacesOpenKey) === '1');
  // The conversations pinned in this browser, listed first under Pinned (UX spec C).
  const pinnedKey = storageKey(storageKeyPrefix, STORAGE_KEYS.pinnedConversations);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => readCollapsed(pinnedKey));
  const togglePin = (id: string) =>
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStorage('local', pinnedKey, next.size > 0 ? JSON.stringify([...next]) : null);
      return next;
    });
  const isPinned = (c: ChatConversationSummary) => c.pinned === true || pinnedIds.has(c.conversationId);
  const showWorkspaces = (open: boolean) => {
    setWorkspacesShown(open);
    writeStorage('local', workspacesOpenKey, open ? '1' : null);
  };
  // The list's width, kept while it is collapsed and across reloads.
  const widthKey = storageKey(storageKeyPrefix, STORAGE_KEYS.conversationListWidth);
  const [width, setWidth] = useState(() => readListWidth(widthKey));
  // What this panel leaves the list: its bounds, the width drawn, or its rail.
  const layout = listLayout(panelWidth, width);
  const resize = (next: number, commit: boolean) => {
    next = Math.min(next, layout.max);
    setWidth(next);
    // The default width is no choice: nothing is kept for it.
    if (commit) writeStorage('local', widthKey, next === LIST_WIDTH.default ? null : String(next));
  };

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

  // Said as a change, not a set: the panel applies it to the groups open
  // then, so one made after an await (a workspace created) loses no other.
  const setGroupOpened = (key: string, open: boolean) => {
    if (openedGroups) onGroupOpenedChange?.(key, open);
  };

  const toggleGroup = (key: string) => {
    if (openedGroups) {
      setGroupOpened(key, !openedGroups.has(key));
      return;
    }
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeStorage('local', collapsedKey, JSON.stringify([...next]));
      return next;
    });
  };

  const say = (reason: string | null, fallback: string) => onNotice?.(reason || t(fallback));

  const move = async (conversationId: string, workspaceId: string | null) => {
    // A drop on the group the row is already in (or an unfiled row on "Not in
    // a workspace") is no move: the row menu disables it, the drop ignores it.
    if (!workspaces || isNoopMove(conversations, conversationId, workspaceId)) return;
    await workspaces.onMove(conversationId, workspaceId);
  };

  // Sections that follow the search make it worth offering whatever the
  // number of conversations: what the user looks for may be among theirs.
  const sectionsSearch = typeof sections === 'function';
  const searchOffered = sectionsSearch || conversations.length > searchThreshold;
  // A box that hides takes its query with it: nothing stays filtered out of sight.
  useEffect(() => {
    if (!searchOffered) setQuery('');
  }, [searchOffered]);
  const search = searchOffered ? query.trim() : '';
  const q = search.toLowerCase();
  // With the host's sections searched too, only the user's own conversations are known to match nothing.
  const noMatch = sectionsSearch ? t('None of your conversations matches') : t('No conversation matches');
  const matches = useMemo(() => (q ? (c: ChatConversationSummary) => conversationMatches(c, q) : undefined), [q]);
  // A workspace that disappears (deleted, unshared) takes the filter back to every workspace.
  const filter =
    workspaces && (workspaceFilter === WORKSPACE_FILTER.none || workspaceFilter === WORKSPACE_FILTER.all || workspaces.list.some((w) => w.id === workspaceFilter))
      ? workspaceFilter
      : WORKSPACE_FILTER.all;
  const filtering = filter !== WORKSPACE_FILTER.all;
  const filtered = useMemo(
    () => conversations.filter((c) => inWorkspaceFilter(c, filter) && (!matches || matches(c))),
    [conversations, matches, filter],
  );
  const grouped = useMemo(
    () => (workspaces ? groupConversations(conversations, workspaces.list, { matches }) : null),
    [conversations, workspaces, matches],
  );
  // Collapsed: the groups the user has not opened, where the host keeps those; else the ones they collapsed.
  const collapsedGroupKeys = openedGroups
    ? new Set((grouped?.groups ?? []).map((group) => group.key).filter((key) => !openedGroups.has(key)))
    : collapsedGroups;
  const fileable = workspaces ? fileableWorkspaces(workspaces.list) : [];
  const noConversationYet = !loading && !q && conversations.length === 0;
  // A conversation about to start in a workspace shows where it will be.
  const workspacesOpen = workspacesShown || creatingWorkspace || (!!workspaces?.pendingWorkspaceId && !activeConversationId);
  const workspaceNames = useMemo(() => new Map((workspaces?.list ?? []).map((w) => [w.id, w.name])), [workspaces]);
  // One agent in the list (the default, filtered to one): no per-row agent icon.
  const severalAgents = useMemo(() => showsSeveralAgents(conversations), [conversations]);

  // Collapsed, or no room beside a readable conversation: a 48 px rail of
  // three icon buttons. Expand and Search are offered only where the list has
  // room to open.
  if (!overlay && (collapsed || layout.rail)) {
    return (
      <div data-testid="filigran-chat-list-rail" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r chat-border-200/10 py-3">
        <ChatIconButton label={t('New conversation')} icon={<EditIcon size={20} />} onClick={() => onNewChat()} />
        {!layout.rail && (
          <>
            <ChatIconButton
              label={t('Search conversations...')}
              icon={<SearchIcon size={20} />}
              onClick={() => {
                setFocusSearch(true);
                onToggleCollapsed();
              }}
            />
            <ChatIconButton label={t('Show conversations')} icon={<SidebarIcon size={20} />} aria-expanded={false} onClick={onToggleCollapsed} />
          </>
        )}
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
      pinned={isPinned(c)}
      onTogglePin={togglePin}
      onSelect={onSelect}
      onDelete={onDelete}
      fileable={workspaces ? fileable : undefined}
      onMove={move}
      actions={rowActions}
      channel={channelName(c.channel, channelLabel)}
      workspaceName={workspaces && c.workspaceId ? (workspaceNames.get(c.workspaceId) ?? t('Other workspaces')) : null}
      showAgent={severalAgents}
      generating={!!generatingConversationId && c.conversationId === generatingConversationId}
      t={t}
    />
  );
  // Most recent first, cut by date under sticky 24 px headers (UX spec C).
  const renderDated = (list: ChatConversationSummary[]) =>
    groupByDate(list, new Date(), t, isPinned).map((group) => (
      <div key={group.key} role="group" aria-label={group.label}>
        <div className="sticky top-0 z-[1] flex h-6 items-center bg-elevation-default px-2 text-content-compact font-medium text-default-secondary">
          {group.label}
        </div>
        {group.conversations.map(renderRow)}
      </div>
    ));

  return (
    <div
      className={`relative shrink-0 flex flex-col border-r chat-border-200/10 ${overlay ? 'h-full max-w-[85%] chat-surface-raised shadow-global-shadow' : ''}`}
      style={{ width: overlay ? LIST_WIDTH.default : layout.width }}
      data-testid={overlay ? 'filigran-chat-list-drawer-panel' : undefined}
    >
      {!overlay && <ListResizeHandle width={layout.width} max={layout.max} onResize={resize} t={t} />}
      <div className="flex items-center gap-1 px-3 py-3">
        <Button priority="secondary" className="min-w-0 flex-1 justify-start" startIcon={<EditIcon size={16} />} onClick={() => onNewChat()}>
          {t('New conversation')}
        </Button>
        {workspaces && workspaces.list.length > 0 && (
          <Select value={filter} onValueChange={setWorkspaceFilter}>
            <SelectTrigger aria-label={t('Filter by workspace')} data-testid="filigran-chat-workspace-filter" className="w-28 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WORKSPACE_FILTER.all}>{t('All workspaces')}</SelectItem>
              <SelectItem value={WORKSPACE_FILTER.none}>{t('Not in a workspace')}</SelectItem>
              {workspaces.list.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {headerActions}
        <ChatIconButton label={t('Hide conversations')} icon={<SidebarIcon size={20} />} aria-expanded onClick={onToggleCollapsed} />
      </div>

      {searchOffered && (
        <div className="px-3 pb-2">
          {/* The design system's field (UX spec C): its clear cross and Escape both empty the query. */}
          <SearchField
            size="sm"
            fullWidth
            value={query}
            ref={(el) => {
              if (el && focusSearch) {
                el.focus();
                setFocusSearch(false);
              }
            }}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            clearLabel={t('Clear search')}
            onKeyDown={(e) => {
              // Escape while an input method composes cancels the composition, not the search.
              if (e.key === 'Escape' && isComposing(e)) e.preventDefault();
            }}
            placeholder={t('Search conversations...')}
            aria-label={t('Search conversations...')}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-3 filigran-chat-scrollable">
        {loading && conversations.length === 0 && (
          <div role="status" aria-busy="true" aria-label={t('Loading conversations')} data-testid="filigran-chat-list-loading">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex h-8 items-center px-2">
                <Skeleton className={`h-3 ${i % 2 ? 'w-3/5' : 'w-4/5'}`} />
              </div>
            ))}
          </div>
        )}

        {failed && !loading && conversations.length === 0 ? (
          <ConversationListFailed onRetry={() => onRetry?.()} className="px-3 py-2" t={t} />
        ) : grouped && workspaces ? (
          <>
            {/* Every conversation, most recent first; a drop here takes one out of its workspace. */}
            <DropZone onDropConversation={(conversationId) => void move(conversationId, null)} accepts>
              {renderDated(filtered)}
              {noConversationYet && <p className="px-3 py-1.5 text-content-compact chat-text-muted-400/30">{t('No conversations yet')}</p>}
            </DropZone>
            {q && filtered.length === 0 && <p className="px-3 py-2 text-content-compact chat-text-muted-400/40">{noMatch}</p>}
            {/*
              The workspaces leave the top of the list (UX spec C): one folded
              line under the conversations, opened on demand, where they are
              created, renamed and started from; the header filter narrows the
              list to one of them. Hidden while searching or filtering: the
              list then shows every match, each naming its workspace.
            */}
            {!q && !filtering && (
              <div className="mt-2 border-t chat-border-200/10 pt-2">
                <div className="group/wsh flex items-center gap-1 chat-radius-sm px-1.5 py-1 hover:chat-surface-hover-100/6">
                  <button
                    data-ds-exempt="disclosure-row"
                    type="button"
                    onClick={() => showWorkspaces(!workspacesOpen)}
                    aria-expanded={workspacesOpen}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <ChevronRightIcon size={12} className={`shrink-0 chat-text-muted-400/30 transition-transform ${workspacesOpen ? 'rotate-90' : ''}`} />
                    <FolderIcon size={14} className="shrink-0 text-[var(--chat-accent)]" />
                    <span className="truncate text-content-base font-medium chat-text-800/80">{t('Workspaces')}</span>
                    <span className="ml-auto shrink-0 pr-1 text-content-compact tabular-nums chat-text-muted-400/30">{grouped.groups.length}</span>
                  </button>
                  <ChatIconButton
                    label={t('New workspace')}
                    icon={<FolderPlusIcon size={16} />}
                    size="sm"
                    onClick={() => {
                      showWorkspaces(true);
                      setCreatingWorkspace(true);
                    }}
                  />
                </div>
                {workspacesOpen && (
                  <div className="pl-2">
                    {creatingWorkspace && (
                      <NameField
                        placeholder={t('Workspace name')}
                        onSubmit={async (name) => {
                          setCreatingWorkspace(false);
                          if (!name) return;
                          const result = await workspaces.onCreate(name);
                          if (!result.ok) say(result.error, 'The workspace could not be created');
                          // It opens: it is where the user is about to drop things.
                          else if (result.workspace) setGroupOpened(result.workspace.id, true);
                        }}
                        onCancel={() => setCreatingWorkspace(false)}
                      />
                    )}
                    {grouped.groups.map((group) => (
                      <WorkspaceGroupSection
                        key={group.key}
                        workspace={group.workspace}
                        count={group.conversations.length}
                        open={groupIsOpen(group.key, collapsedGroupKeys, group, activeConversationId, false)}
                        toggleable={groupCanToggle(group, activeConversationId, false)}
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
                        {group.conversations.length > 0 ? group.conversations.map(renderRow) : <EmptyWorkspaceHint t={t} />}
                      </WorkspaceGroupSection>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {!loading && conversations.length === 0 && <p className="px-3 py-2 text-content-compact chat-text-muted-400/40">{t('No conversations yet')}</p>}
            {conversations.length > 0 && filtered.length === 0 && <p className="px-3 py-2 text-content-compact chat-text-muted-400/40">{noMatch}</p>}
            {renderDated(filtered)}
          </>
        )}
        {typeof sections === 'function' ? <HostSections draw={sections} query={search} /> : sections}
        {onClearAll && conversations.length > 0 && !q && (
          <ClearAllConversations onClear={onClearAll} action={clearAllAction} className="px-2 pt-3" t={t} />
        )}
      </div>

      {notice && (
        <ChatNotice tone="error" className="mx-3 mb-3">
          {notice}
        </ChatNotice>
      )}
    </div>
  );
};

/**
 * The list's right edge, dragged to resize it: arrow keys move it by a step,
 * Home and End to its bounds, a double-click puts the default width back.
 */
const ListResizeHandle = ({
  width,
  max,
  onResize,
  t,
}: {
  width: number;
  /** The widest this panel lets the list be. */
  max: number;
  /** `commit`: the gesture is over, the width is the one to keep. */
  onResize: (width: number, commit: boolean) => void;
  t: (key: string) => string;
}) => {
  // `last`: the width the pointer reached, which a release before the next
  // render must keep rather than the one this render was drawn at.
  const drag = useRef<{ x: number; width: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const end = () => {
    if (!drag.current) return;
    const { last } = drag.current;
    drag.current = null;
    setDragging(false);
    onResize(last, true);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Resize the conversation list')}
      aria-valuemin={LIST_WIDTH.min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // No text selected along the way.
        e.preventDefault();
        drag.current = { x: e.clientX, width, last: width };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        drag.current.last = clampListWidth(drag.current.width + e.clientX - drag.current.x);
        onResize(drag.current.last, false);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => onResize(LIST_WIDTH.default, true)}
      onKeyDown={(e) => {
        const next =
          e.key === 'ArrowLeft'
            ? width - LIST_WIDTH_STEP
            : e.key === 'ArrowRight'
              ? width + LIST_WIDTH_STEP
              : e.key === 'Home'
                ? LIST_WIDTH.min
                : e.key === 'End'
                  ? max
                  : null;
        if (next === null) return;
        e.preventDefault();
        onResize(clampListWidth(next), true);
      }}
      className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-hidden"
    >
      <span
        className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
          dragging ? 'bg-[var(--chat-accent)]' : 'group-hover:bg-[var(--chat-accent)]/40 group-focus-visible:bg-[var(--chat-accent)]'
        }`}
      />
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
      className={`chat-radius-sm transition-colors ${over ? 'bg-[var(--chat-accent)]/10 ring-1 ring-[var(--chat-accent)]/40' : ''} ${className}`}
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

/**
 * An empty workspace's hint: its New conversation button's glyph, named as the
 * button is, where the sentence puts `{icon}`. Only a workspace one may file
 * into is listed empty (`groupConversations`), and it has that button.
 */
const EmptyWorkspaceHint = ({ t }: { t: (key: string) => string }) => {
  const { before, after, hasSlot } = translateAround(t, 'Drop a conversation here, or start one with {icon}.', 'icon');
  return (
    <p className="px-3 py-1.5 text-content-compact chat-text-muted-400/30">
      {before}
      {hasSlot && (
        <span role="img" aria-label={t('New conversation in this workspace')} className="inline-block align-[-1px]">
          <EditIcon size={11} />
        </span>
      )}
      {after}
    </p>
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
        if (isComposing(e)) return;
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          settled.current = true;
          onCancel();
        }
      }}
      onBlur={commit}
      placeholder={placeholder}
      aria-label={placeholder}
      className="mx-2 mb-1 w-[calc(100%-1rem)] chat-radius-sm chat-input-surface-white/10 px-2 py-1 text-content-base chat-text-900/100 outline-hidden ring-1 ring-[var(--chat-accent)]"
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
      <div className="group/ws flex items-center gap-1 chat-radius-sm px-1.5 py-1 hover:chat-surface-hover-100/6">
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
            data-ds-exempt="disclosure-row"
            type="button"
            onClick={onToggle}
            disabled={!toggleable}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
          >
            <ChevronRightIcon size={12} className={`shrink-0 chat-text-muted-400/30 transition-transform ${open ? 'rotate-90' : ''}`} />
            <FolderIcon size={14} className="shrink-0 text-[var(--chat-accent)]" />
            <span className="truncate text-content-base font-medium chat-text-800/80">{workspace ? workspace.name : t('Other workspaces')}</span>
            {isMyDefault && (
              <span className="shrink-0 chat-radius-sm bg-[var(--chat-accent)]/10 px-1 text-content-compact text-[var(--chat-accent)]">{t('default')}</span>
            )}
            <span className="ml-auto shrink-0 pr-1 text-content-compact tabular-nums chat-text-muted-400/30">{count}</span>
          </button>
        )}
        {workspace && manageable && !renaming && (
          <span className="flex shrink-0 items-center opacity-0 group-hover/ws:opacity-100 focus-within:opacity-100 transition-opacity">
            {confirmingDelete ? (
              <>
                <span className="px-1 text-content-compact text-[var(--chat-danger)]">{t('Delete?')}</span>
                <ChatIconButton
                  label={t('Delete workspace')}
                  icon={<CheckIcon size={16} />}
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(workspace.id);
                  }}
                />
                <ChatIconButton label={t('Cancel')} icon={<CloseIcon size={16} />} size="sm" onClick={() => setConfirmingDelete(false)} />
              </>
            ) : (
              <>
                <ChatIconButton label={t('New conversation in this workspace')} icon={<EditIcon size={16} />} size="sm" onClick={() => onNewChat(workspace.id)} />
                <ChatIconButton label={t('Rename workspace')} icon={<PencilIcon size={16} />} size="sm" onClick={() => setRenaming(true)} />
                {/* The default cannot be deleted: every person keeps one. */}
                {!workspace.isDefault && (
                  <ChatIconButton
                    label={t('Delete workspace')}
                    icon={<TrashIcon size={16} />}
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                  />
                )}
              </>
            )}
          </span>
        )}
      </div>
      {open && (
        <div className="space-y-0.5 pb-1 pl-3">
          {pending && (
            <div className="flex items-center gap-2 chat-radius-sm bg-[var(--chat-accent)]/10 px-2.5 py-1.5 text-content-compact text-[var(--chat-accent)]">
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

/**
 * A row's leading icon: the conversation agent's own (an image, an emoji or a
 * name the host draws, as the header does), the panel's bot glyph otherwise.
 */
const RowAgentIcon = ({ icon }: { icon: string | undefined }) => (
  <AgentIconGlyph
    icon={icon}
    size={14}
    fallback={<BotIcon size={13} />}
    imageClassName="h-4 w-4 chat-radius-sm object-cover"
    emojiClassName="text-content-base leading-none"
  />
);

const ConversationRow = ({
  conversation: c,
  isActive,
  isEditing,
  draftTitle,
  onDraftTitleChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  pinned = false,
  onTogglePin,
  onSelect,
  onDelete,
  fileable,
  onMove,
  actions,
  channel,
  workspaceName = null,
  showAgent = false,
  generating = false,
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
  /** Listed under Pinned: its menu offers Unpin instead of Pin. */
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Workspaces the row can be moved into; omitted when there are no workspaces. */
  fileable?: ChatWorkspace[];
  onMove: (conversationId: string, workspaceId: string | null) => void;
  actions?: (conversation: ChatConversationSummary) => ReactNode;
  /** The channel the conversation was started in, when the row names it. */
  channel: string | null;
  /** The workspace the conversation is filed in, said on its row; `null` for none. */
  workspaceName?: string | null;
  /** Whether the row draws its agent's icon: only when the list mixes agents. */
  showAgent?: boolean;
  /** Its answer is being written: a small spinner ends the row (UX spec C). */
  generating?: boolean;
  t: (key: string) => string;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const movable = !!fileable && !isEditing;
  const shownTitle = rowTitle(c) || t('Untitled conversation');
  // What the one-line row no longer spells out: the agent, the channel, the workspace, the time.
  const hintExtra = [
    c.agentName,
    channel ? translate(t, 'Started in {channel}', { channel }) : null,
    workspaceName,
    c.updatedAt ? timeAgo(c.updatedAt, t) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const rowHint = hintExtra ? `${shownTitle}\n${hintExtra}` : shownTitle;
  // Read out after the title: the last words and the details the tooltip shows.
  const description = [c.title?.trim() ? c.lastMessagePreview?.trim() : null, hintExtra].filter(Boolean).join(' · ') || undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive}
      aria-description={description}
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
      // One 32 px line (UX spec C, 11 Nov 2026): the title, its agent's icon only
      // when the list mixes agents; the agent, the channel and the workspace are
      // said in the tooltip, never as a second line.
      className={`group relative flex h-8 w-full items-center gap-2 chat-radius-sm px-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-accent)] ${
        isActive ? 'bg-elevation-highlight text-default-primary font-medium' : 'text-default-secondary hover:bg-input-hover'
      }`}
    >
      {showAgent && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          <RowAgentIcon icon={c.agentIcon} />
        </span>
      )}
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
              if (isComposing(e)) return;
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={onCommitRename}
            aria-label={t('Conversation title')}
            className="w-full chat-radius-sm chat-input-surface-white/10 px-1.5 py-0.5 text-content-base chat-text-900/100 outline-hidden ring-1 ring-[var(--chat-accent)]"
          />
        ) : (
          // The whole title, and what the row no longer spells out, on hover.
          <Tooltip title={rowHint} truncated={!hintExtra} className="flex min-w-0 max-w-full">
            <span className="block min-w-0 truncate text-content-base">{shownTitle}</span>
          </Tooltip>
        )}
      </span>
      {generating && !isEditing && (
        // Under the actions on hover: the More button takes the row's end then.
        <Spinner size="sm" tone="inherit" label={t('Writing an answer')} className="shrink-0 group-hover:invisible group-focus-within:invisible" />
      )}
      {!isEditing && (
        // Over the row's end, not beside it: hidden, the actions keep no
        // width, so the title and the agent pill take the whole row.
        <span
          data-row-actions=""
          className={`absolute inset-y-0 right-1 my-auto flex h-fit items-center gap-0.5 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 ${
            menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {actions && (
            // The row selects on click and on Enter/Space: the host's controls keep theirs.
            <span className="flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {actions(c)}
            </span>
          )}
          {/* One 24 px More button (UX spec C, 11 Nov 2026): rename, move and
              delete live in the design system's Menu, kept inside the panel's
              stacking context (portalled={false}) and non-modal. */}
          <Menu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
            <MenuTrigger asChild>
              <ChatIconButton
                label={t('More actions')}
                icon={<MoreIcon size={16} />}
                size="sm"
                tooltip={!menuOpen}
                active={menuOpen}
                // The row selects on click: the menu's trigger keeps its own.
                onClick={(e) => e.stopPropagation()}
              />
            </MenuTrigger>
            <MenuContent portalled={false} align="end" className="z-[10000]" onClick={(e) => e.stopPropagation()}>
              {onStartRename && (
                <MenuItem startIcon={<EditIcon size={16} />} onSelect={() => onStartRename(c.conversationId, c.title || '')}>
                  {t('Rename conversation')}
                </MenuItem>
              )}
              {onTogglePin && (
                <MenuItem startIcon={pinned ? <PinOffIcon size={16} /> : <PinIcon size={16} />} onSelect={() => onTogglePin(c.conversationId)}>
                  {pinned ? t('Unpin conversation') : t('Pin conversation')}
                </MenuItem>
              )}
              {movable && (
                <>
                  <MenuSeparator />
                  <MenuLabel>{t('Move to workspace')}</MenuLabel>
                  {fileable.map((w) => (
                    <MenuItem
                      key={w.id}
                      startIcon={<FolderIcon size={16} />}
                      selected={w.id === c.workspaceId}
                      disabled={w.id === c.workspaceId}
                      onSelect={() => onMove(c.conversationId, w.id)}
                    >
                      {w.name}
                    </MenuItem>
                  ))}
                  <MenuItem startIcon={<CloseIcon size={16} />} disabled={!c.workspaceId} onSelect={() => onMove(c.conversationId, null)}>
                    {t('Remove from workspace')}
                  </MenuItem>
                </>
              )}
              {(onStartRename || onTogglePin || movable) && <MenuSeparator />}
              <MenuItem startIcon={<TrashIcon size={16} />} onSelect={() => setConfirmingDelete(true)}>
                {t('Delete conversation')}
              </MenuItem>
            </MenuContent>
          </Menu>
          {/* Delete is confirmed in the design system's Dialog, never on one click. */}
          <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
            <DialogContent size="sm" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DialogTitle>{t('Delete conversation?')}</DialogTitle>
              <DialogDescription>{t('The conversation and its messages are deleted. This cannot be undone.')}</DialogDescription>
              <DialogFooter>
                <Button priority="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                  {t('Cancel')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(c.conversationId);
                  }}
                >
                  {t('Delete')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </span>
      )}
    </div>
  );
};
