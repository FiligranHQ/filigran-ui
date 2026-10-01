import type { ApiEndpoints, BackendType, ChatConversationRef, ChatConversationReferenceCandidate } from '../types';

/**
 * The `@` grammar of the composer: what opens the conversation menu, which
 * `@tokens` a message carries, and which picks still count.
 *
 * The same rule as the XTM One web chat, so a message reads the same on both
 * surfaces: a pick from the menu is the only thing that makes `@key` mean a
 * conversation. The composer records it and drops it once its `@key` is edited
 * out of the text, so a bare `@word` typed by hand stays plain text.
 *
 * The web chat writes the rule as the lookbehind `(?<![\w-])@([\w-]*)$`. It is
 * spelled out here instead: the bundle targets ESNext untranspiled, and an
 * engine without lookbehind would refuse the whole module at parse time.
 *
 * Kept free of local runtime imports so `node --test` runs it as is.
 */

/** What one message references at most - the backend's own bound. */
export const MAX_REFERENCED_CONVERSATIONS = 5;

/** How many conversations the menu lists. */
export const REFERENCE_MENU_LIMIT = 8;

/** How long the typed text rests before the conversations are searched. */
export const REFERENCE_SEARCH_DEBOUNCE_MS = 150;

/** A character a key is made of: what `[\w-]` matches. */
const isKeyChar = (ch: string | undefined): boolean => ch !== undefined && /[\w-]/.test(ch);

/** A key the grammar reads back as one token. */
const KEY_RE = /^[\w-]+$/;

/** The `@` being typed: where it sits, and what follows it up to the caret. */
export interface ReferenceTrigger {
  /** Index of the `@` in the text. */
  anchor: number;
  query: string;
}

/**
 * The `@` token being typed before the caret, or null.
 *
 * The `@` must not follow a key character, so an email (`user@host`) never
 * opens the menu - the same rule as `referenceTokens`, so whatever opens the
 * menu also parses as a reference once inserted.
 */
export function referenceTrigger(textBeforeCaret: string): ReferenceTrigger | null {
  // Only the last `@` can match: nothing between it and the end may be anything
  // but key characters.
  const match = /@([\w-]*)$/.exec(textBeforeCaret);
  if (!match || isKeyChar(textBeforeCaret[match.index - 1])) return null;
  return { anchor: match.index, query: match[1] };
}

/** The `@tokens` of *text*, lowercased, each once, in order of appearance. */
export function referenceTokens(text: string): string[] {
  const tokens: string[] = [];
  const re = /@([\w-]+)/g;
  let match = re.exec(text);
  while (match !== null) {
    const key = match[1].toLowerCase();
    if (!isKeyChar(text[match.index - 1]) && !tokens.includes(key)) tokens.push(key);
    match = re.exec(text);
  }
  return tokens;
}

/**
 * *refs* without the picks whose `@key` *text* no longer holds - the same
 * array when nothing was dropped, so a state setter can bail out.
 */
export function pruneConversationRefs(refs: ChatConversationRef[], text: string): ChatConversationRef[] {
  if (refs.length === 0) return refs;
  const tokens = new Set(referenceTokens(text));
  const kept = refs.filter((r) => tokens.has(r.key.toLowerCase()));
  return kept.length === refs.length ? refs : kept;
}

/** *refs* plus *pick*, unless that conversation is already there. */
export function withConversationRef(refs: ChatConversationRef[], pick: ChatConversationRef): ChatConversationRef[] {
  return refs.some((r) => r.conversationId === pick.conversationId) ? refs : [...refs, pick];
}

/**
 * The conversations a message references: the picks whose `@key` it holds, in
 * the order the keys appear, each once, at most `MAX_REFERENCED_CONVERSATIONS`.
 */
export function referencedConversations(refs: ChatConversationRef[], text: string): ChatConversationRef[] {
  if (refs.length === 0) return [];
  const out: ChatConversationRef[] = [];
  for (const token of referenceTokens(text)) {
    for (const ref of refs) {
      if (ref.key.toLowerCase() !== token || out.some((r) => r.conversationId === ref.conversationId)) continue;
      out.push(ref);
    }
  }
  return out.slice(0, MAX_REFERENCED_CONVERSATIONS);
}

/**
 * *text* with the `@partial` of *trigger* replaced by `@<key> `, and where the
 * caret goes: after the space. A space already following it is reused rather
 * than doubled.
 */
export function insertConversationReference(text: string, trigger: ReferenceTrigger, key: string): { text: string; caret: number } {
  const before = text.slice(0, trigger.anchor);
  const after = text.slice(trigger.anchor + 1 + trigger.query.length);
  const token = `@${key}`;
  const space = /^\s/.test(after) ? '' : ' ';
  return { text: `${before}${token}${space}${after}`, caret: before.length + token.length + 1 };
}

/**
 * Defensive parse of the menu's candidates (`{ conversations: [...] }` or a
 * bare array). An entry without an id, or whose key would not read back as
 * one `@token`, is skipped: inserting it would reference nothing.
 */
export function parseReferenceCandidates(data: unknown): ChatConversationReferenceCandidate[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown> | null)?.conversations)
      ? ((data as Record<string, unknown>).conversations as unknown[])
      : [];
  const out: ChatConversationReferenceCandidate[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id || typeof c.key !== 'string' || !KEY_RE.test(c.key)) continue;
    if (out.some((o) => o.id === c.id)) continue;
    out.push({
      id: c.id,
      title: typeof c.title === 'string' ? c.title.trim() : '',
      key: c.key,
      updatedAt: typeof c.updated_at === 'string' ? c.updated_at : undefined,
      // Absent reads as the user's own: the hint is for a share, and a
      // backend that does not say has nothing to warn about.
      isOwn: c.is_own !== false,
    });
  }
  return out;
}

/**
 * The search URL of the menu, or null while the feature is off: the host did
 * not name the route, or the backend has no per-path routing.
 */
export function conversationReferencesUrl(apiBaseUrl: string, apiEndpoints: ApiEndpoints | undefined, backendType: BackendType): string | null {
  const path = apiEndpoints?.conversationReferences;
  if (backendType !== 'rest' || apiEndpoints?.singleEndpoint || typeof path !== 'string' || !path) return null;
  return `${apiBaseUrl}${path}`;
}

/** *url* with the menu's query: the typed text, the page size and the conversation written in. */
export function referenceSearchUrl(url: string, query: string, exclude?: string | null): string {
  const params = new URLSearchParams({ limit: String(REFERENCE_MENU_LIMIT) });
  if (query) params.set('q', query);
  if (exclude) params.set('exclude', exclude);
  return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** What the search last answered, and for which typed text. */
export interface ReferenceSearchState {
  query: string | null;
  items: ChatConversationReferenceCandidate[];
  /** The request failed: nothing is known, so nothing is shown. */
  failed: boolean;
}

export const EMPTY_REFERENCE_SEARCH: ReferenceSearchState = { query: null, items: [], failed: false };

/** What the menu shows. */
export type ReferenceMenuView =
  | { kind: 'closed' }
  | { kind: 'results'; items: ChatConversationReferenceCandidate[] }
  /** A typed query nothing matches. */
  | { kind: 'empty' }
  /** The message already references as many conversations as it may. */
  | { kind: 'full' };

/**
 * The menu for the `@` being typed.
 *
 * The previous answer stays on screen while the next one loads, so typing
 * never empties the menu; "no match" is said only once the backend answered
 * the very text typed, and only for a text: an empty `@` with nothing to offer
 * is simply no menu.
 */
export function referenceMenuView(options: {
  trigger: ReferenceTrigger | null;
  dismissed: boolean;
  search: ReferenceSearchState;
  /** How many conversations the text already references. */
  referenced: number;
  /** The conversation written in, never offered. */
  exclude?: string | null;
}): ReferenceMenuView {
  const { trigger, dismissed, search, referenced, exclude } = options;
  if (!trigger || dismissed) return { kind: 'closed' };
  if (referenced >= MAX_REFERENCED_CONVERSATIONS) return { kind: 'full' };
  if (search.failed) return { kind: 'closed' };
  const items = exclude ? search.items.filter((c) => c.id !== exclude) : search.items;
  if (items.length > 0) return { kind: 'results', items };
  if (trigger.query && search.query === trigger.query) return { kind: 'empty' };
  return { kind: 'closed' };
}
