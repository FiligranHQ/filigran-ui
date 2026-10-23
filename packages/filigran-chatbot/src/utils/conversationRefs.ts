import type { ApiEndpoints, BackendType, ChatConversationRef, ChatConversationReferenceCandidate } from '../types';
import { optInRoute } from './routes';

/**
 * The composer's `@` grammar, as in the XTM One web chat: only a pick from the
 * menu makes `@key` mean a conversation. No regex lookbehind: the bundle ships
 * untranspiled.
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
  return optInRoute(apiBaseUrl, apiEndpoints, backendType, 'conversationReferences');
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

/**
 * Whether *candidate* answers the typed *query*, by its key or by its title.
 * A title's spaces become hyphens in its key (`Hi Bob` is `@hi-bob`), so the
 * key typed back must also find it by the words of its title.
 */
export function referenceMatches(query: string, candidate: { key: string; title: string }): boolean {
  const q = query.toLowerCase();
  if (!q || candidate.key.toLowerCase().startsWith(q)) return true;
  const title = candidate.title.toLowerCase();
  const words = q.split(/[\s_-]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => title.includes(w));
}

/** How many conversations the menu remembers to match locally (`rememberCandidates`). */
export const REMEMBERED_CANDIDATES_LIMIT = 200;

const sameCandidate = (a: ChatConversationReferenceCandidate, b: ChatConversationReferenceCandidate) =>
  a.id === b.id && a.key === b.key && a.title === b.title && a.isOwn === b.isOwn && a.updatedAt === b.updatedAt;

/**
 * *seen* with *items* added: the latest version of each conversation, most
 * recent last, at most `REMEMBERED_CANDIDATES_LIMIT`. *seen* itself when every
 * item is already there as is, so a state holding it does not re-render.
 */
export function rememberCandidates(
  seen: ChatConversationReferenceCandidate[],
  items: ChatConversationReferenceCandidate[],
): ChatConversationReferenceCandidate[] {
  if (items.every((item) => seen.some((c) => sameCandidate(c, item)))) return seen;
  const ids = new Set(items.map((c) => c.id));
  const next = [...seen.filter((c) => !ids.has(c.id)), ...items];
  return next.length > REMEMBERED_CANDIDATES_LIMIT ? next.slice(next.length - REMEMBERED_CANDIDATES_LIMIT) : next;
}

/**
 * *seen* after a search answer: the rows a settled answer should have listed
 * and did not are forgotten (deleted or unshared since), then its rows are
 * remembered. An absence is proven only under the narrowest contract every
 * backend keeps - the title contains `q` as typed - and by a complete answer
 * (under a page): a backend that does not match by key yet answers `hi-bob`
 * with nothing, and "Hi Bob" must stay. The conversation written in is
 * excluded by the request, not gone.
 */
export function rememberAnswer(
  seen: ChatConversationReferenceCandidate[],
  search: ReferenceSearchState,
  exclude?: string | null,
): ChatConversationReferenceCandidate[] {
  if (search.query === null || search.failed) return seen;
  const query = search.query;
  const listed = new Set(search.items.map((c) => c.id));
  const complete = search.items.length < REFERENCE_MENU_LIMIT;
  const q = query.toLowerCase();
  const kept = complete ? seen.filter((c) => c.id === exclude || listed.has(c.id) || !c.title.toLowerCase().includes(q)) : seen;
  return rememberCandidates(kept.length === seen.length ? seen : kept, search.items);
}

/** A pick of the draft as a menu row; a pick that does not say whose it is reads as the user's own. */
export function refAsCandidate(ref: ChatConversationRef): ChatConversationReferenceCandidate {
  return { id: ref.conversationId, title: ref.title, key: ref.key, isOwn: ref.isOwn ?? true };
}

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
  /**
   * The conversations already met (the menu's past answers, the draft's
   * picks), matched here by key or title after the search's own answer: an
   * edited `@hi-bob`, or one a keystroke broke, still finds "Hi Bob" whatever
   * the search answered.
   */
  known?: ChatConversationReferenceCandidate[];
}): ReferenceMenuView {
  const { trigger, dismissed, search, referenced, exclude, known = [] } = options;
  if (!trigger || dismissed) return { kind: 'closed' };
  if (referenced >= MAX_REFERENCED_CONVERSATIONS) return { kind: 'full' };
  if (search.failed) return { kind: 'closed' };
  const local = trigger.query ? known.filter((c) => referenceMatches(trigger.query, c) && !search.items.some((s) => s.id === c.id)) : [];
  const merged = [...search.items, ...local].slice(0, REFERENCE_MENU_LIMIT);
  const items = exclude ? merged.filter((c) => c.id !== exclude) : merged;
  if (items.length > 0) return { kind: 'results', items };
  if (trigger.query && search.query === trigger.query) return { kind: 'empty' };
  return { kind: 'closed' };
}
