/**
 * Browser-storage keys of the panel. A host mounting several panels (XTM One's
 * floating assistant beside its own chat page) namespaces them with
 * `storageKeyPrefix`; without one the keys are the historical ones.
 */
export const STORAGE_KEYS = {
  conversationId: 'filigranChatConversationId',
  legacyChatId: 'filigranChatLegacyChatId',
  agentSlug: 'filigranChatAgentSlug',
  sidebarWidth: 'filigranChatSidebarWidth',
  collapsedWorkspaces: 'filigran-chat-collapsed-workspaces',
  draft: 'filigranChatDraft:',
  draftRefs: 'filigranChatDraftRefs:',
} as const;

export function storageKey(prefix: string | undefined, key: string): string {
  return prefix ? `${prefix}:${key}` : key;
}

type StorageArea = 'local' | 'session';

function area(kind: StorageArea): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Read a key; `null` when storage is unavailable or blocked. */
export function readStorage(kind: StorageArea, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Write a key, or remove it for `null` / `''`; a blocked storage is ignored. */
export function writeStorage(kind: StorageArea, key: string, value: string | null): void {
  try {
    const store = area(kind);
    if (!store) return;
    if (value) store.setItem(key, value);
    else store.removeItem(key);
  } catch {
    // Private browsing or a full quota: the panel works without persistence.
  }
}
