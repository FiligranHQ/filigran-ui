/**
 * `@filigran/chatbot/workspaces` — how the panel groups a conversation list by
 * workspace, with none of the panel: pure functions, no React, no DOM, no CSS,
 * so a host's own conversation list groups and orders exactly as the panel's.
 *
 * Read the backend's workspace list with `parseWorkspaces` (archived ones are
 * left out there; `userId` decides which are the caller's own where the backend
 * sends no `is_own`), then group the host's conversations, its own type kept
 * whole, given `conversationId` and `workspaceId`:
 *
 * ```ts
 * const workspaces = parseWorkspaces(list, { userId: me.id });
 * const { groups, unfiled } = groupConversations(
 *   conversations.map((c) => ({ ...c, conversationId: c.id, workspaceId: c.workspace_id })),
 *   workspaces,
 *   { matches: search ? (c) => c.title.includes(search) : undefined },
 * );
 * ```
 */
export {
  ELSEWHERE_GROUP,
  fileableWorkspaces,
  groupCanToggle,
  groupConversations,
  groupIsOpen,
  parseWorkspaces,
  sortWorkspaces,
} from './utils/workspaces';
export type { GroupableConversation, WorkspaceGroup } from './utils/workspaces';
export type { ChatWorkspace } from './types';
