import { useCallback, useState } from 'react';
import type { ApiEndpoints, BackendType, ChatConversationSummary } from '../types';

interface UseConversationsOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
}

interface UseConversationsReturn {
  /** Whether the history feature is available at all (REST backend with a sessions endpoint). */
  historyEnabled: boolean;
  conversations: ChatConversationSummary[];
  conversationsLoading: boolean;
  /** Fetch (or re-fetch) the conversation list. No-ops when history is disabled. */
  refreshConversations: () => Promise<void>;
  /** Delete a conversation server-side. Returns true on success. */
  deleteConversation: (id: string) => Promise<boolean>;
  /** Rename a conversation server-side. Returns true on success. */
  renameConversation: (id: string, title: string) => Promise<boolean>;
}

/**
 * Normalize one raw conversation entry from the backend list response.
 * Defensive: skips entries without a conversation id, accepts both the
 * snake_case REST shape and a few aliases so older proxies keep working.
 */
function parseConversation(raw: unknown): ChatConversationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const id = c.conversation_id ?? c.id;
  if (typeof id !== 'string' || !id) return null;
  // Keep the raw (trimmed) title; the localized "Untitled conversation"
  // fallback is applied at render time (ChatHeader) so it goes through the
  // component's translation function instead of being hardcoded in English.
  const title = typeof c.title === 'string' ? c.title.trim() : '';
  const updatedAt = typeof c.updated_at === 'string' ? c.updated_at : typeof c.created_at === 'string' ? c.created_at : undefined;
  const messageCount = typeof c.message_count === 'number' ? c.message_count : undefined;
  const agentName = typeof c.agent_name === 'string' && c.agent_name ? c.agent_name : undefined;
  return { conversationId: id, title, updatedAt, messageCount, agentName };
}

/**
 * Multi-conversation history for the REST backend (mirrors the XTM One web
 * chat sidebar). The conversation list is fetched lazily — when the history
 * menu opens — via `GET {apiBaseUrl}{sessions}`, and conversations are
 * deleted via `DELETE {apiBaseUrl}{sessions}/{conversation_id}`.
 *
 * Degrades gracefully: a backend that doesn't implement the list endpoint
 * yet (404/405/network error) simply yields an empty list, so the menu shows
 * its empty state instead of breaking the chat.
 */
export function useConversations({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  requestHeaders,
}: UseConversationsOptions): UseConversationsReturn {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const historyEnabled = backendType === 'rest' && !apiEndpoints?.singleEndpoint && apiEndpoints?.sessions !== null && apiEndpoints?.history !== null;

  const sessionsUrl = `${apiBaseUrl}${apiEndpoints?.history ?? apiEndpoints?.sessions ?? '/chat/sessions'}`;

  const refreshConversations = useCallback(async () => {
    if (!historyEnabled) return;
    setConversationsLoading(true);
    try {
      const res = await fetch(sessionsUrl, {
        method: 'GET',
        headers: { ...(requestHeaders ?? {}) },
      });
      if (!res.ok) {
        setConversations([]);
        return;
      }
      const data: unknown = await res.json();
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.conversations)
          ? ((data as Record<string, unknown>).conversations as unknown[])
          : [];
      setConversations(rawList.map(parseConversation).filter((c): c is ChatConversationSummary => c !== null));
    } catch {
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [historyEnabled, sessionsUrl, requestHeaders]);

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      if (!historyEnabled) return false;
      try {
        const res = await fetch(`${sessionsUrl}/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { ...(requestHeaders ?? {}) },
        });
        if (!res.ok) return false;
        setConversations((prev) => prev.filter((c) => c.conversationId !== id));
        return true;
      } catch {
        return false;
      }
    },
    [historyEnabled, sessionsUrl, requestHeaders],
  );

  const renameConversation = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      const trimmed = title.trim();
      // An empty title is a no-op rather than an error: the backend would name
      // the conversation from its first message anyway, and silently wiping a
      // title because the user cleared the field and hit Enter is worse.
      if (!historyEnabled || !trimmed) return false;
      // Optimistic: the row is being edited in place, so waiting for the
      // round-trip would make it flicker back to the old title first.
      const previous = conversations;
      setConversations((prev) => prev.map((c) => (c.conversationId === id ? { ...c, title: trimmed } : c)));
      try {
        const res = await fetch(`${sessionsUrl}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) {
          setConversations(previous);
          return false;
        }
        return true;
      } catch {
        setConversations(previous);
        return false;
      }
    },
    [historyEnabled, sessionsUrl, requestHeaders, conversations],
  );

  return { historyEnabled, conversations, conversationsLoading, refreshConversations, deleteConversation, renameConversation };
}
