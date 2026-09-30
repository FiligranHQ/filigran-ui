import type { ChatConversationSummary, ChatWorkspace } from '../types';

/**
 * The conversation list grouped by workspace, and the workspace payload.
 *
 * The same rule as the XTM One web chat's sidebar, so a person sees the same
 * groups on both surfaces:
 *
 * - every workspace the caller may file into has a group, empty or not - a
 *   workspace just created must be there to drop a conversation onto;
 * - one the caller may only read has a group only while it holds one of their
 *   conversations;
 * - a conversation filed where the list does not reach (an archived
 *   workspace, one no longer shared) lands in one `elsewhere` group rather
 *   than vanishing;
 * - a search keeps the matching conversations and hides the groups it
 *   empties.
 *
 * Kept free of local runtime imports so `node --test` runs it as is.
 */

export const ELSEWHERE_GROUP = '__elsewhere__';

export interface WorkspaceGroup {
  /** `null` for the `elsewhere` group. */
  workspace: ChatWorkspace | null;
  key: string;
  conversations: ChatConversationSummary[];
}

/** Defensive parse of the workspace list: entries without an id or a name are skipped. */
export function parseWorkspaces(data: unknown): ChatWorkspace[] {
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
      isOwn: w.is_own === true,
      isDefault: w.is_default === true,
      canManage: w.can_manage === true,
    });
  }
  return out;
}

/** The caller's own default first, then by name. */
export function sortWorkspaces(workspaces: ChatWorkspace[]): ChatWorkspace[] {
  const mine = (w: ChatWorkspace) => w.isDefault && w.isOwn;
  return [...workspaces].sort((a, b) => {
    if (mine(a) !== mine(b)) return mine(a) ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** The workspaces a conversation can be moved into, in the order the list shows them. */
export function fileableWorkspaces(workspaces: ChatWorkspace[]): ChatWorkspace[] {
  return sortWorkspaces(workspaces.filter((w) => w.canManage));
}

export function groupConversations(
  conversations: ChatConversationSummary[],
  workspaces: ChatWorkspace[],
  options: { matches?: (c: ChatConversationSummary) => boolean } = {},
): { groups: WorkspaceGroup[]; unfiled: ChatConversationSummary[] } {
  const { matches } = options;
  const shown = matches ? conversations.filter(matches) : conversations;
  const known = new Set(workspaces.map((w) => w.id));
  const held = new Set(conversations.map((c) => c.workspaceId).filter((id): id is string => !!id));

  const byWorkspace = new Map<string, ChatConversationSummary[]>();
  const elsewhere: ChatConversationSummary[] = [];
  const unfiled: ChatConversationSummary[] = [];
  for (const c of shown) {
    const id = c.workspaceId ?? null;
    if (!id) unfiled.push(c);
    else if (known.has(id)) byWorkspace.set(id, [...(byWorkspace.get(id) ?? []), c]);
    else elsewhere.push(c);
  }

  const groups: WorkspaceGroup[] = [];
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
 * the conversation on screen, and always while searching.
 */
export function groupIsOpen(
  key: string,
  collapsed: ReadonlySet<string>,
  group: { conversations: ChatConversationSummary[] },
  activeConversationId: string | null,
  searching: boolean,
): boolean {
  if (searching) return true;
  if (activeConversationId && group.conversations.some((c) => c.conversationId === activeConversationId)) return true;
  return !collapsed.has(key);
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
