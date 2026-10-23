import type { ChatConversationSummary, ChatWorkspace } from '../types';

/**
 * The conversation list grouped by workspace, the one rule a host's own list
 * shares through `@filigran/chatbot/workspaces`. No local runtime imports, so
 * `node --test` runs it as is.
 */

/** The key of the group of conversations filed in a workspace the list does not show. */
export const ELSEWHERE_GROUP = '__elsewhere__';

/** What the grouping reads of a conversation; a host's own type passes through whole. */
export type GroupableConversation = Pick<ChatConversationSummary, 'conversationId' | 'workspaceId'>;

export interface WorkspaceGroup<C extends GroupableConversation = ChatConversationSummary, W extends ChatWorkspace = ChatWorkspace> {
  /** `null` for the `elsewhere` group. */
  workspace: W | null;
  /** The workspace's id, or `ELSEWHERE_GROUP`. */
  key: string;
  conversations: C[];
}

/**
 * Defensive parse of the workspace list (a bare array or `{ workspaces }`):
 * entries without an id or a name are skipped, and so are archived ones,
 * which take no conversation. A workspace is the caller's own by its
 * `is_own`, or, where the backend sends none, by its `user_id` being
 * *userId*.
 */
export function parseWorkspaces(data: unknown, options: { userId?: string } = {}): ChatWorkspace[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown> | null)?.workspaces)
      ? ((data as Record<string, unknown>).workspaces as unknown[])
      : [];
  const out: ChatWorkspace[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== 'string' || !w.id || typeof w.name !== 'string') continue;
    // An archived workspace takes no conversation; the backend already leaves
    // it out, and a proxy that did not would offer a choice that can only fail.
    if (w.is_archived === true) continue;
    out.push({
      id: w.id,
      name: w.name,
      isOwn: typeof w.is_own === 'boolean' ? w.is_own : !!options.userId && w.user_id === options.userId,
      isDefault: w.is_default === true,
      canManage: w.can_manage === true,
    });
  }
  return out;
}

/** The caller's own default first, then by name. */
export function sortWorkspaces<W extends ChatWorkspace>(workspaces: W[]): W[] {
  const mine = (w: ChatWorkspace) => w.isDefault && w.isOwn;
  return [...workspaces].sort((a, b) => {
    if (mine(a) !== mine(b)) return mine(a) ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Whether a failed read of the workspace list is a passing one (a timeout, a
 * rate limit, a server error) that keeps the last list, rather than a refusal
 * (not licensed, an older proxy) that turns the grouping off.
 */
export function isTransientListFailure(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status !== 501);
}

/** Whether moving *conversationId* to *destination* would change nothing (it is already there). */
export function isNoopMove(
  conversations: Pick<ChatConversationSummary, 'conversationId' | 'workspaceId'>[],
  conversationId: string,
  destination: string | null,
): boolean {
  const current = conversations.find((c) => c.conversationId === conversationId);
  return !!current && (current.workspaceId ?? null) === destination;
}

/**
 * Whether the next conversation can still be created in *pendingId*: the list
 * read last offers it to file into. One deleted, archived or unshared since
 * (from another tab, the web chat) is not, and the session request must not
 * name it.
 */
export function pendingWorkspaceStillFileable(pendingId: string, workspaces: ChatWorkspace[]): boolean {
  return workspaces.some((w) => w.id === pendingId && w.canManage);
}

/** The shortest gap between two re-reads on a return to the page (`focus` and `visibilitychange` both fire). */
export const RETURN_REFRESH_MIN_GAP_MS = 2000;

/** Whether a return to the page re-reads the lists: once per return, not once per event. */
export function returnRefreshDue(now: number, last: number | null): boolean {
  return last === null || now - last >= RETURN_REFRESH_MIN_GAP_MS;
}

/** The workspaces a conversation can be moved into, in the order the list shows them. */
export function fileableWorkspaces<W extends ChatWorkspace>(workspaces: W[]): W[] {
  return sortWorkspaces(workspaces.filter((w) => w.canManage));
}

/**
 * The groups of the conversation list, in order, and the conversations filed
 * in none: a group for each workspace the caller may file into, empty or not,
 * and for one they may only read while it holds a conversation of theirs;
 * the conversations filed in a workspace not listed go to one `ELSEWHERE_GROUP`.
 * With *matches* (a search) only the matching conversations are kept, and
 * the groups left empty go.
 */
export function groupConversations<C extends GroupableConversation, W extends ChatWorkspace>(
  conversations: C[],
  workspaces: W[],
  options: { matches?: (c: C) => boolean } = {},
): { groups: WorkspaceGroup<C, W>[]; unfiled: C[] } {
  const { matches } = options;
  const shown = matches ? conversations.filter(matches) : conversations;
  const known = new Set(workspaces.map((w) => w.id));
  const held = new Set(conversations.map((c) => c.workspaceId).filter((id): id is string => !!id));

  const byWorkspace = new Map<string, C[]>();
  const elsewhere: C[] = [];
  const unfiled: C[] = [];
  for (const c of shown) {
    const id = c.workspaceId ?? null;
    if (!id) unfiled.push(c);
    else if (known.has(id)) byWorkspace.set(id, [...(byWorkspace.get(id) ?? []), c]);
    else elsewhere.push(c);
  }

  const groups: WorkspaceGroup<C, W>[] = [];
  for (const workspace of sortWorkspaces(workspaces)) {
    const inside = byWorkspace.get(workspace.id) ?? [];
    if (!workspace.canManage && !held.has(workspace.id)) continue;
    if (matches && inside.length === 0) continue;
    groups.push({ workspace, key: workspace.id, conversations: inside });
  }
  if (elsewhere.length > 0) groups.push({ workspace: null, key: ELSEWHERE_GROUP, conversations: elsewhere });
  return { groups, unfiled };
}

/**
 * Whether a group shows its conversations: not when collapsed, unless it holds
 * the conversation on screen, and always while searching. A group shown open
 * for either reason cannot be toggled (`groupCanToggle`).
 */
export function groupIsOpen(
  key: string,
  collapsed: ReadonlySet<string>,
  group: { conversations: GroupableConversation[] },
  activeConversationId: string | null,
  searching: boolean,
): boolean {
  if (searching) return true;
  if (activeConversationId && group.conversations.some((c) => c.conversationId === activeConversationId)) return true;
  return !collapsed.has(key);
}

/**
 * Whether a group's toggle may fold it: not while it is held open by a search
 * or by the conversation on screen, where a click would flip a remembered
 * state nobody sees, which then folds the group later.
 */
export function groupCanToggle(group: { conversations: GroupableConversation[] }, activeConversationId: string | null, searching: boolean): boolean {
  if (searching) return false;
  return !(activeConversationId && group.conversations.some((c) => c.conversationId === activeConversationId));
}

/**
 * Undo one refused move in the conversation list: the conversation goes back
 * to where it was, and only while it is still where this move put it - once a
 * later move or a refresh has placed it, that placement stands. Every other
 * row is kept as the list holds it now, not as it was when the move started.
 */
export function revertMove<T extends Pick<ChatConversationSummary, 'conversationId' | 'workspaceId'>>(
  list: T[],
  conversationId: string,
  destination: string | null,
  previous: string | null | undefined,
): T[] {
  const index = list.findIndex((c) => c.conversationId === conversationId);
  if (index < 0 || (list[index].workspaceId ?? null) !== destination) return list;
  const next = [...list];
  next[index] = { ...list[index], workspaceId: previous };
  return next;
}

/**
 * What an empty "Not in a workspace" group says: that there is no
 * conversation at all, that every one is filed, or nothing. Nothing while
 * searching: the group then holds matches only, and a search that matches
 * nothing has its own message.
 */
export function unfiledEmptyNote(options: { total: number; unfiled: number; loading: boolean; searching: boolean }): 'none' | 'all-filed' | null {
  const { total, unfiled, loading, searching } = options;
  if (unfiled > 0 || loading || searching) return null;
  return total === 0 ? 'none' : 'all-filed';
}

/** The message of a refused workspace request, from XTM One's `detail`. */
export async function refusalMessage(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    const detail = (body as Record<string, unknown> | null)?.detail;
    return typeof detail === 'string' && detail ? detail : null;
  } catch {
    return null;
  }
}
