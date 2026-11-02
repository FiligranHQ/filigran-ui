/**
 * The conversation list's rows: what a search matches, where a conversation
 * written in goes, and the channel a row names.
 */
import type { ChatConversationSummary } from '../types';
import { askHost } from './askHost';

/** Whether *conversation* matches *query* (lower-cased, trimmed): its title, last message or agent. */
export function conversationMatches(conversation: ChatConversationSummary, query: string): boolean {
  return [conversation.title, conversation.lastMessagePreview, conversation.agentName].some(
    (field) => !!field && field.toLowerCase().includes(query),
  );
}

/**
 * *list* with conversation *id* first, as written in just now with *preview*:
 * the backend lists by last activity, and its read-back comes only at the end
 * of the turn. *list* itself when it does not hold *id*.
 */
export function touchConversation(list: ChatConversationSummary[], id: string, preview: string, now: Date): ChatConversationSummary[] {
  const index = list.findIndex((c) => c.conversationId === id);
  if (index < 0) return list;
  const touched = { ...list[index], updatedAt: now.toISOString(), ...(preview.trim() ? { lastMessagePreview: preview.trim() } : {}) };
  return [touched, ...list.slice(0, index), ...list.slice(index + 1)];
}

/**
 * *list* with a refused rename of *id* undone: the row gets *previous* back,
 * unless its title changed since (a later rename, a read-back).
 */
export function revertRename(list: ChatConversationSummary[], id: string, attempted: string, previous: string): ChatConversationSummary[] {
  return list.map((c) => (c.conversationId === id && c.title === attempted ? { ...c, title: previous } : c));
}

/** Product names of the channels a conversation may come from besides the panel's own. */
const CHANNEL_NAMES: Record<string, string> = {
  slack: 'Slack',
  teams: 'Teams',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
  google_chat: 'Google Chat',
};

/**
 * The name a row gives *channel*: the host's (`null` names none), else the
 * product's for a known messaging channel, else none - the panel's own
 * channels (`web`, `api`, …) are where the user already is.
 */
export function channelName(channel: string | undefined, hostLabel?: (channel: string) => string | null | undefined): string | null {
  if (!channel) return null;
  const own = askHost(hostLabel, channel);
  if (own !== undefined) return own?.trim() || null;
  return CHANNEL_NAMES[channel.toLowerCase()] ?? null;
}
