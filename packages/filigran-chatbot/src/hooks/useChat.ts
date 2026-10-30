import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentStatusState,
  ApiEndpoints,
  ChatSendDecision,
  ChatSendDraft,
  ChatSendOutcome,
  ChatHeldOutcome,
  ChatTurnOutcome,
  BackendType,
  ChatContextUsage,
  ChatConversationRef,
  ChatFile,
  ChatMessage,
  ChatStreamEventInfo,
  ToolApprovalDecision,
  ToolApprovalProposal,
} from '../types';
import type { ParsedAction, ProtocolContext } from './protocols';
import { parseAgUiEvent, parseLegacyEvent, parseRestEvent } from './protocols';
import { parseToolApprovalProposals, storedMessageId } from './protocols/parseRestEvent';
import { createStreamDeltas, type StreamDeltas } from './streamDeltas';
import { createSessionGate } from '../utils/sessionGate';
import { conversationReferencesUrl, pruneConversationRefs, referencedConversations, withConversationRef } from '../utils/conversationRefs';
import { hostTakesPageActions, performPageAction, waitForDomSettle, type PageAction } from '../utils/pageActions';
import { takePageSnapshot } from '../utils/pageSnapshot';
import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from '../utils/storage';
import { readSseEvents } from '../utils/sse';
import { randomId } from '../utils/randomId';
import { askHost } from '../utils/askHost';
import { hasFailedUpload } from '../utils/failedUpload';
import { readRefusalDetail, requestHeadersKey } from '../utils/refusal';
import { mentionedAgentIds, pruneAgentMentions, withAgentMention, type AgentMention } from '../utils/agentMentions';
import { usePanelFetch } from './usePanelRequests';
import { optInRoute } from '../utils/routes';

// Unsent composer text is kept per conversation so closing the panel (hosts
// unmount `<ChatPanel/>` when it is closed) or switching conversation doesn't
// discard a half-written question. `sessionStorage`, not `localStorage`: a
// draft is scoped to the tab and dies with it.

/** Debounce on draft writes so a fast typist doesn't hit storage per keystroke. */
const DRAFT_PERSIST_DELAY_MS = 300;

const draftKey = (prefix: string | undefined, conversationId: string | null): string =>
  storageKey(prefix, `${STORAGE_KEYS.draft}${conversationId ?? 'new'}`);

/**
 * The `@` picks of a draft, kept beside its text: only a pick makes `@key`
 * reference a conversation, so a draft restored without them would go out with
 * its `@key`s as plain text.
 */
const draftRefsKey = (prefix: string | undefined, conversationId: string | null): string =>
  storageKey(prefix, `${STORAGE_KEYS.draftRefs}${conversationId ?? 'new'}`);

function loadDraftRefs(prefix: string | undefined, conversationId: string | null): ChatConversationRef[] {
  try {
    const parsed: unknown = JSON.parse(readStorage('session', draftRefsKey(prefix, conversationId)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ChatConversationRef =>
        !!r && typeof r === 'object' && typeof r.conversationId === 'string' && typeof r.key === 'string' && typeof r.title === 'string',
    );
  } catch {
    return [];
  }
}

function persistDraft(prefix: string | undefined, conversationId: string | null, value: string, refs: ChatConversationRef[]): void {
  writeStorage('session', draftKey(prefix, conversationId), value);
  writeStorage('session', draftRefsKey(prefix, conversationId), refs.length > 0 ? JSON.stringify(refs) : null);
}

/** A conversation's draft: its text and the `@` picks it still holds. */
function loadDraftState(prefix: string | undefined, conversationId: string | null): { text: string; refs: ChatConversationRef[] } {
  const text = readStorage('session', draftKey(prefix, conversationId)) ?? '';
  return { text, refs: pruneConversationRefs(loadDraftRefs(prefix, conversationId), text) };
}

/**
 * How often to check on a turn resumed by a decision made on a recovered
 * (streamless) prompt, and the backstop that ends the watch regardless.
 *
 * Such a turn has no stream left to write to — the backend persists the answer
 * and suppresses the live `done` frame — so the panel watches the pause-recovery
 * route instead, which reports whether the turn is still running. That is a
 * definite stop condition rather than a guess at how long an agent might take,
 * and each poll doubles as the sign of life that keeps the turn from being
 * abandoned. The deadline is only a backstop against a turn-state marker that
 * somehow never clears; the ordinary end is the turn reporting itself idle.
 */
const RESUME_POLL_MS = 5000;
const RESUME_WATCH_MS = 900000;

/**
 * How often to re-assert that somebody is still here while a recovered prompt
 * is on screen.
 *
 * A paused turn gives up after 30 minutes with no sign of a client, and after a
 * reload the stream that would have vouched for the reviewer is gone for good —
 * so presence is inferred from requests about the conversation instead. A tab
 * left open on the prompt IS a client present, but it makes no requests, so
 * without this the turn would abandon a reviewer who is simply taking their
 * time. Well inside the server's window, since missing it costs the whole turn.
 */
const APPROVAL_PRESENCE_INTERVAL_MS = 600000;

/**
 * How long a dropped turn waits for the event stream to reopen, at most: the
 * backend restarting takes as long as it takes, and the replay or the end of
 * the turn comes once it is back.
 */
const HANDOVER_BACKSTOP_MS = RESUME_WATCH_MS;
/** How long a dropped turn is awaited when the event stream cannot open (no conversation to follow yet). */
const HANDOVER_UNFOLLOWED_MS = 15000;
/** How long Stop waits for the backend to end a cancelled turn before letting go of it. */
const CANCEL_GRACE_MS = 10000;
/**
 * How long a stream the server keeps alive (a `: keepalive` every 15 s) may
 * stay silent before it is taken for dead and dropped (`readSseEvents`).
 */
const SSE_IDLE_TIMEOUT_MS = 45000;
/** Reconnection backoff of the conversation's event stream. */
const EVENTS_RETRY_BASE_MS = 1000;
const EVENTS_RETRY_MAX_MS = 30000;
/**
 * How long the page may stay hidden before its event stream is closed. Under
 * HTTP/1.1 a browser holds six connections per origin, and a background tab
 * keeping one open starves the tabs in use; shown again, the stream reopens
 * and the conversation is read back.
 */
const EVENTS_HIDDEN_CLOSE_MS = 60000;
/**
 * How long a relayed turn waits for the event stream's snapshot to replay it,
 * once the stream reopened or the page that let go of it shows again: nothing
 * by then, and it ended while the stream was away (a reopened stream never
 * brings back a turn already over).
 */
const EVENTS_RESUME_GRACE_MS = 5000;
/** How long a relayed turn that ended out of sight waits for the read-back that says how. */
const UNSEEN_END_READ_BACK_MS = 10000;
/** How many turns ended by a provisional end are remembered, awaiting their stored end. */
const PROVISIONAL_ENDS_KEPT = 20;
/**
 * How long sends wait, after a turn's provisional end, for its stored end: the
 * backend still holds the conversation while the turn winds down, and a
 * message sent then would join the ending turn and never be answered.
 */
const WIND_DOWN_MS = 5000;
/** How long an event stream must have lived, with no frame on it, for its next drop to retry from the shortest delay. */
const EVENTS_HEALTHY_MS = 5000;

/** The statuses that do not end an agent's wait (`wait_start`). */
const STATUSES_DURING_WAIT: ReadonlySet<string> = new Set(['wait_status', 'tool_progress', 'consult_progress']);

/** The actions that belong to a turn, as opposed to the conversation. */
const TURN_ACTIONS: ReadonlySet<ParsedAction['action']> = new Set(['status', 'stream', 'done', 'approval_required', 'error', 'cancelled']);

/** The message body's fields the panel owns: a host's extras cannot set them. */
const PANEL_FIELDS: ReadonlySet<string> = new Set([
  'mentioned_agent_ids',
  'content',
  'conversation_id',
  'agent_slug',
  'supports_tool_approval',
  'supports_page_actions',
  'supports_artifacts',
  'referenced_conversation_ids',
  'file_ids',
  'context',
]);

type DoneAction = Extract<ParsedAction, { action: 'done' }>;

/** *message* closed by *parsed*: its text, the turn's metadata and its persisted id. */
function withDone(message: ChatMessage, parsed: DoneAction, content: string, completedAt: Date): ChatMessage {
  return {
    ...message,
    content,
    timestamp: completedAt,
    toolNames: parsed.toolNames,
    toolCallCount: parsed.toolCallCount,
    iterations: parsed.iterations,
    attachments: parsed.attachments,
    artifacts: parsed.artifacts,
    reasoning: parsed.reasoning,
    toolCallTrace: parsed.toolCallTrace,
    transferChain: parsed.transferChain,
    isTruncated: parsed.isTruncated,
    agentName: parsed.answeredBy?.agentName ?? message.agentName,
    answeredBy: parsed.answeredBy,
    mentionFailed: parsed.mentionFailed,
    serverId: parsed.messageId ?? message.serverId,
    raw: parsed.raw ?? message.raw,
  };
}

/** What a stored assistant message adds to the bubble on screen it matches: never its text. */
const STORED_ANSWER_FIELDS = [
  'toolNames',
  'toolCallCount',
  'iterations',
  'attachments',
  'artifacts',
  'reasoning',
  'toolCallTrace',
  'transferChain',
  'isTruncated',
  'agentName',
  'answeredBy',
  'mentionFailed',
  'feedback',
] as const satisfies readonly (keyof ChatMessage)[];

// The text a user bubble showing other words was sent with, kept on the
// bubble itself (copies of it keep it) under a key the host never reads.
const SENT_TEXT = Symbol('sentText');
type SentBubble = ChatMessage & { [SENT_TEXT]?: string };

/** *message*, a user bubble sent with *text*: kept on it when it shows other words. */
export function withSentText(message: ChatMessage, text: string): ChatMessage {
  return text === message.content ? message : ({ ...message, [SENT_TEXT]: text } as SentBubble);
}

/** The text *message* was sent with: what the backend stored, and echoes back. */
export function sentTextOf(message: ChatMessage): string {
  return (message as SentBubble)[SENT_TEXT] ?? message.content;
}

/**
 * How a message on screen (*shownKey*: a user bubble by the text it was sent
 * with) and a stored one (*storedKey*) are told the same without a server id.
 */
const shownKey = (m: ChatMessage) => `${m.role}\u0000${m.role === 'user' ? sentTextOf(m) : m.content}`;
const storedKey = (m: ChatMessage) => `${m.role}\u0000${m.content}`;

/**
 * *shown*, the bubble on screen that *stored* is: it keeps what it shows (the
 * words a user bubble was given, the files sent live) and takes the stored
 * id, and an answer what the store adds to it.
 */
function adoptStored(shown: ChatMessage, stored: ChatMessage): ChatMessage {
  const next: ChatMessage = { ...shown, serverId: stored.serverId ?? shown.serverId, raw: stored.raw ?? shown.raw };
  if (shown.role !== 'assistant') return next;
  const fields = next as unknown as Record<string, unknown>;
  for (const key of STORED_ANSWER_FIELDS) if (stored[key] !== undefined) fields[key] = stored[key];
  return next;
}

/**
 * *prev* with the conversation read back (*restored*) put into a turn on
 * screen, *turnIds* its bubbles and *liveId* the one it writes to. The stored
 * messages past those shown before the turn take the place of its bubbles
 * they match - by server id, else by role and text, the bubble staying (see
 * `adoptStored`) - and what the turn shows that is not stored, its live
 * bubble among it, follows them. *prev* as it is when nothing stored is
 * missing.
 */
function mergeIntoTurn(prev: ChatMessage[], restored: ChatMessage[], turnIds: ReadonlySet<string>, liveId: string): ChatMessage[] {
  const start = prev.findIndex((m) => turnIds.has(m.id));
  if (start < 0) return prev;
  const before = prev.slice(0, start);
  const region = prev.slice(start);
  // What the history holds past the last message shown before the turn,
  // less what is on screen before it already, unsaved there.
  const shownBefore = new Set(before.map((m) => m.serverId).filter(Boolean));
  let anchor = -1;
  restored.forEach((m, i) => {
    if (m.serverId && shownBefore.has(m.serverId)) anchor = i;
  });
  const unsavedBefore = new Map<string, number>();
  for (const m of before) if (!m.serverId) unsavedBefore.set(shownKey(m), (unsavedBefore.get(shownKey(m)) ?? 0) + 1);
  const missing = restored.slice(anchor + 1).filter((m) => {
    if (m.serverId && shownBefore.has(m.serverId)) return false;
    const pending = unsavedBefore.get(storedKey(m)) ?? 0;
    if (pending === 0) return true;
    unsavedBefore.set(storedKey(m), pending - 1);
    return false;
  });
  if (missing.length === 0) return prev;
  // Each stored message takes the place of the turn's bubble it matches; the
  // live one only by its server id, being still written.
  const taken = new Set<string>();
  const stored = missing.map((m) => {
    const match =
      region.find((r) => !taken.has(r.id) && !!m.serverId && r.serverId === m.serverId) ??
      region.find((r) => !taken.has(r.id) && r.id !== liveId && !r.serverId && shownKey(r) === storedKey(m));
    if (!match) return { ...m, id: storedMessageId(m.serverId) };
    taken.add(match.id);
    return adoptStored(match, m);
  });
  return [...before, ...stored, ...region.filter((m) => !taken.has(m.id))];
}

/**
 * *prev* with user message *message* added while a turn runs: before the
 * answer the turn is still writing (*openId*), which is where the backend
 * stores it and where it reads back, else at the end.
 */
export function withUserMessageDuringTurn(prev: ChatMessage[], message: ChatMessage, openId: string | null): ChatMessage[] {
  const at = openId === null ? -1 : prev.findIndex((m) => m.id === openId);
  return at < 0 ? [...prev, message] : [...prev.slice(0, at), message, ...prev.slice(at)];
}

/**
 * *prev* with the conversation read back (*restored*) merged in, for a
 * read-back that waited for a turn to end. A stored message already on
 * screen - by server id, else an unsaved one by role and text - stays where
 * it is (see `adoptStored`); one missing goes after the message shown for the
 * stored one before it, in stored order, and before anything shown since
 * that the store does not hold. With none of it on screen (a first
 * read-back), the history goes above what is shown.
 */
export function mergeReadBack(prev: ChatMessage[], restored: ChatMessage[]): ChatMessage[] {
  const next = [...prev];
  const byServerId = new Map<string, number>();
  next.forEach((m, i) => {
    if (m.serverId) byServerId.set(m.serverId, i);
  });
  const taken = new Set<number>();
  // Per position on screen (-1: above it all), the stored messages that go after it.
  const inserts = new Map<number, ChatMessage[]>();
  let anchor = -1;
  let changed = false;
  for (const m of restored) {
    let at = m.serverId !== undefined ? byServerId.get(m.serverId) : undefined;
    if (at === undefined) {
      const key = storedKey(m);
      const found = next.findIndex((p, i) => !taken.has(i) && !p.serverId && shownKey(p) === key);
      if (found >= 0) {
        at = found;
        next[found] = adoptStored(next[found], m);
        changed = true;
      }
    }
    if (at !== undefined) {
      taken.add(at);
      // Never back up: a stored message shown out of order keeps the rest after the latest one.
      anchor = Math.max(anchor, at);
      continue;
    }
    const list = inserts.get(anchor) ?? [];
    list.push({ ...m, id: storedMessageId(m.serverId) });
    inserts.set(anchor, list);
  }
  if (inserts.size === 0) return changed ? next : prev;
  const out: ChatMessage[] = [...(inserts.get(-1) ?? [])];
  next.forEach((m, i) => {
    out.push(m, ...(inserts.get(i) ?? []));
  });
  return out;
}

/** Two texts sent as one. */
const joinTexts = (a: string, b: string) => [a, b].filter(Boolean).join('\n\n');

/** What the bubble of two sends sent as one shows: `undefined` when neither shows other words than its text. */
const joinShown = (a: { text: string; displayText?: string }, b: { text: string; displayText?: string }) =>
  a.displayText !== undefined || b.displayText !== undefined ? joinTexts(a.displayText ?? a.text, b.displayText ?? b.text) : undefined;

/** *b* sent after *a*, as one message. */
function joinHeldParts(a: HeldPart, b: HeldPart): HeldPart {
  const refIds = new Set(a.refs.map((r) => r.conversationId));
  const mentionIds = new Set(a.mentions.map((m) => m.agentId));
  return {
    text: joinTexts(a.text, b.text),
    draft: joinTexts(a.draft, b.draft),
    files: [...a.files, ...b.files],
    refs: [...a.refs, ...b.refs.filter((r) => !refIds.has(r.conversationId))],
    mentions: [...a.mentions, ...b.mentions.filter((m) => !mentionIds.has(m.agentId))],
    extras: a.extras || b.extras ? { ...a.extras, ...b.extras } : undefined,
    displayText: joinShown(a, b),
  };
}

const NO_HELD_PART: HeldPart = { text: '', draft: '', files: [], refs: [], mentions: [] };

/** The message *parts* make, sent as one. */
function heldMessageOf(parts: HeldPart[]): HeldMessage {
  return { ...parts.reduce(joinHeldParts, NO_HELD_PART), parts };
}

/** *part* added to the message already held: one message, sent when the turn ends. */
function mergeHeld(prev: HeldMessage | null, part: HeldPart): HeldMessage {
  return heldMessageOf([...(prev?.parts ?? []), part]);
}

/** Tell each of *parts* it never went out. */
function tellNotSent(parts: HeldPart[]) {
  for (const part of parts) askHost(part.onNotSent);
}

/** A send once `onBeforeSend` had its say: what is sent, what the user's bubble shows, the host's fields. */
interface DecidedSend {
  text: string;
  displayText: string;
  extras?: Record<string, unknown>;
}

/**
 * Apply `onBeforeSend`'s *decision* to *text*: `null` when the host took the
 * send over. The bubble shows `displayText` when the host gave one that says
 * something, else *displayFallback* (the handle's `displayText`) when it
 * does, the text sent otherwise.
 */
export function applySendDecision(text: string, decision: ChatSendDecision | undefined, displayFallback?: string): DecidedSend | null {
  if (decision === false) return null;
  const adjust = decision && typeof decision === 'object' ? decision : undefined;
  const sent = (typeof adjust?.text === 'string' ? adjust.text : text).trim();
  const shown = typeof adjust?.displayText === 'string' ? adjust.displayText.trim() : '';
  const fallback = typeof displayFallback === 'string' ? displayFallback.trim() : '';
  return { text: sent, displayText: shown || fallback || sent, extras: adjust?.extras };
}

type TurnEndAction = Extract<ParsedAction, { action: 'done' | 'error' | 'cancelled' }>;

/** *parsed* when it ends a turn: a last `done`, an `error` or a `cancelled`. */
function turnEndOf(parsed: ParsedAction): TurnEndAction | null {
  return parsed.action === 'error' || parsed.action === 'cancelled' || (parsed.action === 'done' && !parsed.intermediate) ? parsed : null;
}

/** An end marked `provisional: true`: the turn's stored end follows it. */
function isProvisionalEnd(parsed: ParsedAction): boolean {
  return (parsed.action === 'error' || parsed.action === 'cancelled') && !!parsed.provisional;
}

/** What `onStreamEvent` is told of a frame, from the panel's own reading of it (*parsed*, none when unreadable). */
export function streamEventInfo(relayed: boolean, parsed: ParsedAction | undefined): ChatStreamEventInfo {
  const info: ChatStreamEventInfo = { relayed };
  if (!parsed) return info;
  const end = turnEndOf(parsed);
  if (end && isProvisionalEnd(end)) info.end = 'provisional';
  else if (end?.messageId) info.end = 'stored';
  if (parsed.action === 'status' && parsed.resumed) info.replayed = true;
  return info;
}

/** The host's extra body fields, read at send time; a throwing getter sends none. */
function readRequestExtras(getter: (() => Record<string, unknown> | undefined) | undefined): Record<string, unknown> {
  const extras = askHost(getter);
  return extras && typeof extras === 'object' ? extras : {};
}

/** Maximum number of files that can be attached to a single message. */
const DEFAULT_MAX_FILE_COUNT = 10;
/** Maximum total size of all attached files (50 MB). */
const DEFAULT_MAX_TOTAL_SIZE = 50 * 1024 * 1024;

interface UseChatOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  agentSlug: string | null | undefined;
  requestHeaders?: Record<string, string>;
  /** Arbitrary host page/application context, sent as `context` on the REST message body. */
  pageContext?: Record<string, unknown>;
  /** The host's in-app navigation, which `act_on_page` uses to open a path (#5559). */
  onRelativeLinkClick?: (href: string) => void;
  t: (key: string) => string;
  maxFileCount?: number;
  maxTotalSize?: number;
  /** Namespace of the browser-storage keys (see `storageKeyPrefix` on the panel). */
  storageKeyPrefix?: string;
  /**
   * The conversation the host holds, when it controls it: `undefined` leaves the
   * panel on its own persisted one. A controlled id is never written to storage.
   */
  controlledConversationId?: string | null;
  /** Called whenever the active conversation changes, whoever changed it. */
  onConversationIdChange?: (id: string | null) => void;
  /** Extra fields merged into each REST message body (see `getRequestExtras` on the panel). */
  getRequestExtras?: () => Record<string, unknown> | undefined;
  /** Every frame of the message stream and the event stream, as received. */
  onStreamEvent?: (event: Record<string, unknown>, info: ChatStreamEventInfo) => void;
  /** A frame of either stream said the user's session ended. */
  onSessionEnded?: (reason: string | undefined) => void;
  /** A conversation was retitled (`conversation_title`). */
  onConversationTitle?: (conversationId: string | null, title: string) => void;
  /**
   * The conversation whose history is on screen: its event stream is followed
   * only then, so a relayed turn is appended to that history.
   */
  historySettledFor?: string | null;
  /** A steer may carry the composer's uploaded files (`file_ids`). */
  steerAttachments?: boolean;
  /** A message that cannot steer the running turn is held, and sent when it ends. */
  holdSends?: boolean;
  /** `@` can mention agents: the message then carries `mentioned_agent_ids`. */
  agentMentionsEnabled?: boolean;
  /** Sees every send first (see `onBeforeSend` on the panel). */
  onBeforeSend?: (draft: ChatSendDraft) => ChatSendDecision;
  /** Told what became of a held message (see `onHeldSendSettled` on the panel). */
  onHeldSendSettled?: (text: string, outcome: ChatHeldOutcome) => void;
}

/** What a host-driven or held send carries, in place of the composer's content. */
interface SendOverride {
  text: string;
  extras?: Record<string, unknown>;
  files?: ChatFile[];
  refs?: ChatConversationRef[];
  mentions?: AgentMention[];
  /** Already seen by `onBeforeSend` (a held message going out). */
  decided?: boolean;
  /** What the user typed for it, as typed (a held message going out): what Stop gives back should it be held again. */
  draft?: string;
  /**
   * What the user's bubble shows in place of `text` (see `ChatSendDecision`):
   * a held message's, or the handle's own, which `onBeforeSend`'s wins over.
   */
  displayText?: string;
  /** Called as the message opens a turn, long before the send itself resolves at the turn's end. */
  onSent?: () => void;
  /**
   * Called when the message, held (the send resolved `'held'`), never goes
   * out: `onBeforeSend` took it over, Stop or a new conversation let go of
   * it, or the send failed.
   */
  onNotSent?: () => void;
  /**
   * Called once the message steered the running turn, with the turn the
   * backend named (`null`: none) and whether the backend said no turn took it
   * (`answered: false`; otherwise a turn it does not name may have).
   */
  onSteered?: (turnId: string | null, unanswered: boolean) => void;
  /** Who sends it, as `onBeforeSend` is told: the host (default) or a voice call. */
  source?: ChatSendDraft['source'];
}

/** One send held until the running turn ends, as decided. */
interface HeldPart {
  text: string;
  /** What the user typed for it, as typed: what Stop gives back. Empty for a host's send. */
  draft: string;
  files: ChatFile[];
  refs: ChatConversationRef[];
  mentions: AgentMention[];
  extras?: Record<string, unknown>;
  /** What the user's bubble shows in place of `text`, when the host said. */
  displayText?: string;
  /**
   * The send as `onBeforeSend` first saw it, while a turn ran: asked again,
   * with `turnRunning: false`, before it leaves as a new turn.
   */
  asked?: { text: string; source: ChatSendDraft['source']; extras?: Record<string, unknown>; displayText?: string };
  /** Told as it goes out, or that it never does (see `SendOverride.onSent`, `onNotSent`). */
  onSent?: () => void;
  onNotSent?: () => void;
}

/** A message waiting for the running turn to end: its sends (`parts`), joined. */
interface HeldMessage extends Omit<HeldPart, 'asked' | 'onSent' | 'onNotSent'> {
  parts: HeldPart[];
}

/** A relayed turn let go of with the event stream (see `withdrawRelayedTurn`). */
interface WithdrawnTurn {
  turnId: string;
  /** The last stored message on screen as it was let go of: what its answer comes after. */
  shownUpTo: string | null;
  /** Its end, out of sight, awaits the read-back past the *from*-th `reloadHistory` (see `endTurnUnseen`). */
  readBack?: { from: number; timer: number };
}

/** The backend's id of the last message of *messages* it stored, if any. */
function lastStoredId(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const id = messages[i].serverId;
    if (id) return id;
  }
  return null;
}

/**
 * How a turn that ended out of sight ended, by the conversation read back
 * (*restored*): answered when it holds an answer after *shownUpTo* (the last
 * stored message on screen as the turn was let go of; `null`: from the
 * start), stopped when it holds none, or no longer holds *shownUpTo*.
 */
export function unseenTurnOutcome(restored: ChatMessage[], shownUpTo: string | null): ChatTurnOutcome {
  const from = shownUpTo === null ? 0 : restored.findIndex((m) => m.serverId === shownUpTo) + 1;
  if (shownUpTo !== null && from === 0) return 'stopped';
  return restored.slice(from).some((m) => m.role === 'assistant') ? 'answered' : 'stopped';
}

/** What the pause-recovery route says of a conversation. */
interface PendingApprovalsState {
  proposals?: ToolApprovalProposal[];
  turnRunning: boolean;
}

export interface TransferredAgent {
  id: string;
  name: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  /**
   * A turn runs: the one on screen (`isLoading`), or a relayed turn let go
   * of with the event stream while the page was hidden, until the reopened
   * stream or a read-back says it is over (see `withdrawRelayedTurn`).
   */
  turnRunning: boolean;
  /**
   * No turn on screen, yet sends are held: a turn winding down after its
   * provisional end, or one let go of while the page was hidden.
   */
  sendsHeld: boolean;
  /**
   * How the last turn on screen ended, set as `isLoading` turns false (`null`
   * before any turn ended): what `onTurnRunningChange(false, info)` reports.
   */
  turnEnd: ChatTurnOutcome | null;
  agentStatus: AgentStatusState | null;
  attachedFiles: ChatFile[];
  conversationId: string | null;
  /**
   * Context-window occupancy for the active conversation, or `null` while the
   * backend has reported none (a fresh chat, or a backend that does not carry
   * the figures at all). Tracked live off the per-iteration progress frames and
   * finalised on `done`.
   */
  contextUsage: ChatContextUsage | null;
  transferredAgent: TransferredAgent | null;
  /** Forget the transfer a turn reported: the conversation's agent is read back from the server. */
  forgetTransfer: () => void;
  /**
   * True while a response is streaming AND the typed text can be dispatched
   * immediately as a mid-run steering message (REST backend with a steer
   * endpoint and a known conversation id). Gates the steering affordances in
   * the composer (accent Send next to Stop, "Enter to send now" copy).
   */
  canSteer: boolean;
  /**
   * Tool calls the running turn has stopped on, or `null` when nothing is
   * waiting. While set, the turn is paused mid-answer: the stream is open and
   * silent, and only a decision (or aborting the turn) moves it on.
   */
  pendingApprovals: ToolApprovalProposal[] | null;
  /** True while a decision set is in flight to the approve endpoint. */
  isSubmittingApproval: boolean;
  /**
   * Why the last decision submission failed, or `null`. Kept alongside the
   * still-visible prompt rather than replacing it: the turn is paused either
   * way, so the reviewer needs the retry as much as the explanation.
   */
  approvalError: string | null;
  /**
   * Answer a paused turn. Every proposed call must appear exactly once — the
   * backend refuses a partial set, because resuming with an undecided call
   * leaves a `tool_use` block without its `tool_result`, which the model
   * providers reject outright.
   */
  submitApprovalDecisions: (decisions: ToolApprovalDecision[]) => Promise<void>;
  /**
   * True while waiting for the answer to a decision made on a recovered prompt.
   * The turn resumed without a stream to report on, so the panel shows the
   * working indicator itself and re-reads the conversation until the answer
   * lands.
   */
  isResumingAfterDecision: boolean;
  /**
   * Bumped whenever the conversation must be re-read from the server. The panel
   * owns the restore, so this is how the hook asks for one.
   */
  historyReloadNonce: number;
  historyLoadedRef: React.MutableRefObject<boolean>;
  /**
   * Ref mirror of {@link conversationId}, always current across async
   * boundaries. Exposed so the history-restore effect can tell, when its
   * `/chat/sessions` response arrives, whether the conversation it was issued
   * for is still the active one — and ignore a genuinely superseded response
   * (new chat / agent switch) without discarding a restore that was merely
   * torn down by a benign host re-render or a StrictMode double-invoke.
   */
  conversationIdRef: React.MutableRefObject<string | null>;
  handleFileAdd: (fileList: FileList | null) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  /** Send the composer's content, or *override*'s without touching the composer. */
  handleSendMessage: (override?: SendOverride) => Promise<ChatSendOutcome>;
  /** A message held until the running turn ends (`holdSends`), if any. */
  heldMessage: HeldMessage | null;
  /** What the backend said when it refused a steer or a Stop, shown by the composer; `null` when nothing. */
  notice: string | null;
  cancelHeldMessage: () => void;
  /** Read the conversation back from the server again. */
  reloadHistory: () => void;
  /**
   * Put the conversation read back (*restored*) into the relayed turn it was
   * read back for, which runs on: true when one was (see `handleEventFrame`),
   * false when the read-back is the panel's to apply.
   */
  mergeTurnHistory: (restored: ChatMessage[]) => boolean;
  /**
   * The conversation read back for the *readFor*-th read-back asked for
   * (`historyReloadNonce`): *restored*, or `null` when it could not be read.
   */
  settleUnseenEnd: (readFor: number, restored: ChatMessage[] | null) => void;
  /** The agents picked from the `@` menu whose `@key` the draft still holds. */
  agentMentions: AgentMention[];
  addAgentMention: (mention: AgentMention) => void;
  /** End an agent's wait early ("Continue now"); `null` when the host offers no route. */
  skipWait: (() => Promise<void>) | null;
  /** Read what a conversation is paused on and whether its turn runs; `null` when the host offers no route. */
  readPendingApprovals: ((convId: string) => Promise<PendingApprovalsState | null>) | null;
  /**
   * Start a fresh conversation; with *workspaceId* (a string), the session is
   * created inside that workspace (`workspace_id` on the session `POST`).
   */
  handleNewChat: (workspaceId?: string) => void;
  /** The workspace the next conversation will be created in, if any. */
  pendingWorkspaceId: string | null;
  /** Forget *workspaceId* as the next conversation's workspace (it was deleted). */
  clearPendingWorkspace: (workspaceId: string) => void;
  handleStopGenerating: () => void;
  /**
   * The conversations picked from the composer's `@` menu whose `@key` the
   * draft still holds; sent as `referenced_conversation_ids` with the next
   * message.
   */
  conversationRefs: ChatConversationRef[];
  /** Record a pick from the `@` menu. */
  addConversationRef: (ref: ChatConversationRef) => void;
  setAttachedFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /**
   * Seed the context gauge from outside a live turn — the history-restore path,
   * which reads the newest restored assistant message's figures.
   */
  setContextUsage: React.Dispatch<React.SetStateAction<ChatContextUsage | null>>;
  /**
   * Set (or clear) the active conversation id, keeping React state, the
   * cross-async-boundary ref mirror, and localStorage all in sync. Pass
   * `null` to reset. Prefer this over a raw state setter so the id consumed
   * by `handleSendMessage` (which reads the ref) never drifts from what the
   * UI shows.
   */
  updateConversationId: (id: string | null) => void;
  /**
   * Switch to another existing conversation (history menu). Aborts any
   * in-flight request, clears the transcript, and re-arms the history-restore
   * effect so the selected conversation's messages are fetched via the
   * sessions endpoint.
   */
  handleSwitchConversation: (id: string) => void;
}

function getParser(backendType: BackendType): (evt: Record<string, unknown>, ctx: ProtocolContext) => ParsedAction {
  switch (backendType) {
    case 'legacy':
      return parseLegacyEvent;
    case 'ag-ui':
      return parseAgUiEvent;
    default:
      return parseRestEvent;
  }
}

export function buildRequestBody(
  backendType: BackendType,
  content: string,
  opts: {
    legacyChatId: string | null;
    conversationId: string | null;
    agentSlug: string | null | undefined;
    pageContext?: Record<string, unknown>;
    /** See {@link ApiEndpoints.approve} — derived, never a prop of its own. */
    supportsToolApproval?: boolean;
    /** See {@link ApiEndpoints.conversationReferences}. */
    referencedConversationIds?: string[];
    /** Same promise, for `act_on_page` frames (#5559): answered on the approve path. */
    supportsPageActions?: boolean;
    /** The host's own fields; never overriding the panel's. */
    extras?: Record<string, unknown>;
  },
): Record<string, unknown> {
  switch (backendType) {
    case 'legacy':
      return { question: content, chatId: opts.legacyChatId ?? undefined, streaming: true };
    case 'ag-ui':
      return {
        threadId: opts.conversationId ?? randomId(),
        runId: randomId(),
        messages: [{ id: randomId(), role: 'user', content }],
        tools: [],
        context: [],
        state: {},
        forwardedProps: opts.agentSlug ? { agentSlug: opts.agentSlug } : {},
      };
    default: {
      // The host's fields never stand in for the panel's own, set or not.
      const hostFields = Object.fromEntries(Object.entries(opts.extras ?? {}).filter(([key]) => !PANEL_FIELDS.has(key)));
      const body: Record<string, unknown> = { ...hostFields, content, conversation_id: opts.conversationId, agent_slug: opts.agentSlug };
      // Tell the backend this turn may pause on a gated tool call and that we
      // will answer. Sent only when the host named an approve path, because
      // the flag is a promise: a backend that pauses waits indefinitely, so a
      // client that cannot answer must never claim it can. Omitted rather than
      // sent false, so a proxy that rebuilds the body from a fixed field list
      // drops nothing meaningful.
      if (opts.supportsToolApproval) {
        body.supports_tool_approval = true;
      }
      // Only when the message holds a pick: a host that never named the route
      // sends exactly the body it always did.
      if (opts.referencedConversationIds && opts.referencedConversationIds.length > 0) {
        body.referenced_conversation_ids = opts.referencedConversationIds;
      }
      if (opts.supportsPageActions) {
        body.supports_page_actions = true;
      }
      // The panel renders the deck, report and video markers itself whatever
      // the host proxies: the cards need no route to show and link to XTM One.
      body.supports_artifacts = true;
      // Forward arbitrary host page context (e.g. current URL) so the agent
      // knows where the user is. Omitted when empty to keep payloads lean.
      // Guard serialization: the whole body is later JSON.stringify'd, so a
      // non-serializable value (circular reference, BigInt, …) would otherwise
      // throw and break the message send. Drop the context instead — page
      // context is supplementary and must never prevent a message from going out.
      // Decide using the serialized result so values that normalize to an empty
      // object (e.g. `{ url: undefined }`, `{ fn: () => {} }`) are also omitted.
      if (opts.pageContext && Object.keys(opts.pageContext).length > 0) {
        try {
          const serialized = JSON.stringify(opts.pageContext);
          if (serialized && serialized !== '{}') {
            body.context = opts.pageContext;
          }
        } catch {
          // Non-serializable page context — skip it rather than fail the send.
        }
      }
      return body;
    }
  }
}

export function useChat({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  agentSlug,
  requestHeaders,
  pageContext,
  onRelativeLinkClick,
  t,
  maxFileCount = DEFAULT_MAX_FILE_COUNT,
  maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
  storageKeyPrefix,
  controlledConversationId,
  onConversationIdChange,
  getRequestExtras,
  onStreamEvent,
  onSessionEnded,
  onConversationTitle,
  historySettledFor = null,
  steerAttachments = false,
  holdSends = false,
  agentMentionsEnabled = false,
  onBeforeSend,
  onHeldSendSettled,
}: UseChatOptions): UseChatReturn {
  const panelFetch = usePanelFetch();
  const isLegacy = backendType === 'legacy';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [turnEnd, setTurnEnd] = useState<ChatTurnOutcome | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const isControlled = controlledConversationId !== undefined;
  const conversationStorageKey = storageKey(storageKeyPrefix, STORAGE_KEYS.conversationId);
  const legacyChatIdStorageKey = storageKey(storageKeyPrefix, STORAGE_KEYS.legacyChatId);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    isControlled ? (controlledConversationId ?? null) : readStorage('local', conversationStorageKey),
  );
  // Seeded from the persisted draft of whichever conversation we mount into,
  // so re-opening the panel restores what the user had typed - and the
  // conversations it references.
  const [initialDraft] = useState(() => loadDraftState(storageKeyPrefix, conversationId));
  const [inputValue, setInputValue] = useState(initialDraft.text);
  const [conversationRefs, setConversationRefs] = useState<ChatConversationRef[]>(initialDraft.refs);
  const [agentMentions, setAgentMentions] = useState<AgentMention[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  const [transferredAgent, setTransferredAgent] = useState<TransferredAgent | null>(null);
  // How full the model's context window is for this conversation. Conversation
  // state rather than per-message: it describes what the NEXT turn will carry,
  // which is the only thing the user can still act on.
  const [contextUsage, setContextUsage] = useState<ChatContextUsage | null>(null);
  // Tool calls the running turn is paused on. Conversation-level rather than
  // per-message: the pause belongs to the turn, not to any one bubble, and the
  // prompt outlives the segment that was streaming when it arrived.
  const [pendingApprovals, setPendingApprovals] = useState<ToolApprovalProposal[] | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // A prompt recovered after a reload is answered the same way, but resumes
  // differently: there is no stream left to carry the rest of the turn.
  const [isResumingAfterDecision, setIsResumingAfterDecision] = useState(false);
  const [historyReloadNonce, setHistoryReloadNonce] = useState(0);
  // Drives the resume watch's next poll: each tick re-arms the effect.
  const [resumeTick, setResumeTick] = useState(0);
  const [legacyChatId, setLegacyChatId] = useState<string | null>(() => readStorage('local', legacyChatIdStorageKey));

  const historyLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Page actions abort on their own: closing the panel must stop them touching
  // the host page without cancelling the turn, whose answer a host expects to
  // find in history when the panel reopens.
  const pageActionControllerRef = useRef<AbortController | null>(null);
  // The running stream's pending deltas, so stopping it can apply them and a
  // new chat can drop them.
  const streamDeltasRef = useRef<StreamDeltas | null>(null);
  // The turn this panel streams itself, so the event stream never renders it
  // again, and the one of another origin it relays, if any.
  const ownTurnActiveRef = useRef(false);
  const ownTurnIdRef = useRef<string | null>(null);
  const relayedTurnRef = useRef<{ turnId: string; renderer: ReturnType<typeof createTurnRenderer> } | null>(null);
  // A Stop sent to the backend, and the backstop that lets go of the turn if
  // it never reports the end.
  const cancelTimerRef = useRef<number | null>(null);
  // The renderer of the turn on screen, this panel's own or a relayed one:
  // what Stop marks.
  const liveRendererRef = useRef<ReturnType<typeof createTurnRenderer> | null>(null);
  // A relayed turn stopped here: its later frames are not a new turn.
  const stoppedTurnIdRef = useRef<string | null>(null);
  // Stop was pressed: what was held goes back to the composer instead of out.
  const stopRequestedRef = useRef(false);
  // A message waiting for the running turn to end (`holdSends`).
  const [heldMessage, setHeldMessage] = useState<HeldMessage | null>(null);
  const heldMessageRef = useRef(heldMessage);
  heldMessageRef.current = heldMessage;
  // A refused steer's or Stop's reason, until the next send or the turn's end.
  const [notice, setNotice] = useState<string | null>(null);
  // The notice says what becomes of the next send: it outlives the turn's end.
  const noticeUntilSendRef = useRef(false);
  // Relayed turns ended by a provisional end, by turn id, with the answer each
  // left on screen: their stored end only gives that answer its id.
  const provisionalEndsRef = useRef(new Map<string, string>());
  // A turn ended provisionally whose stored end is still to come (see
  // `WIND_DOWN_MS`): sends are held meanwhile. *relayed*: the event stream's.
  const windDownRef = useRef<{ timer: number; relayed: boolean } | null>(null);
  const [windingDown, setWindingDown] = useState(false);
  // The panel's own stream read on past a provisional end, for its stored end:
  // aborted with the chat it belongs to.
  const storedEndControllerRef = useRef<AbortController | null>(null);
  // The panel's own turn has started on the backend: its stream delivered a
  // frame (a backend answers a send once its turn holds the conversation).
  const ownTurnStartedRef = useRef(false);
  // A cancel sent before the own turn started: its answer is awaited
  // ('asked'), or was `turn: "none"`, which says nothing of that turn, and the
  // cancel goes again once the turn starts ('resend').
  const cancelBeforeStartRef = useRef<'off' | 'asked' | 'resend'>('off');
  // Frames applied to the turn on screen so far, and what a Stop found at its
  // click: a refused Stop restores the status only if no frame came since.
  const turnFrameSeqRef = useRef(0);
  const stopContextRef = useRef<{ statusBefore: AgentStatusState | null; approvalsBefore: ToolApprovalProposal[] | null; frameSeq: number } | null>(
    null,
  );
  // A relayed turn on screen whose event stream reopened: it waits for the
  // stream's snapshot to replay it, and is over when none does.
  const resumeWaitRef = useRef<{ turn: { turnId: string }; timer: number } | null>(null);
  // The renderer of a relayed turn the reopened event stream replayed, whose
  // conversation is read back for the segments it closed meanwhile.
  const turnReadBackRef = useRef<ReturnType<typeof createTurnRenderer> | null>(null);
  // A relayed turn let go of with the event stream (see `withdrawRelayedTurn`),
  // whose replay reads the conversation back: until the reopened stream says
  // whether it runs on, or a read-back how it ended (`endTurnUnseen`), sends
  // wait and the host is not told it ended.
  const withdrawnTurnRef = useRef<WithdrawnTurn | null>(null);
  const [turnWithdrawn, setTurnWithdrawn] = useState(false);
  const setWithdrawnTurn = (turn: WithdrawnTurn | null) => {
    const readBack = withdrawnTurnRef.current?.readBack;
    if (readBack && turn !== withdrawnTurnRef.current) window.clearTimeout(readBack.timer);
    withdrawnTurnRef.current = turn;
    setTurnWithdrawn(turn !== null);
  };
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // Read-backs asked for so far (`reloadHistory`): `historyReloadNonce`.
  const historyReloadsRef = useRef(0);
  // This panel's identity on the conversation's event stream: the backend
  // never relays to it the turns it started itself.
  const [clientId, setClientId] = useState(() => randomId());
  // The panel's own turn whose stream dropped, now awaited from the event stream.
  const handoverTimerRef = useRef<number | null>(null);
  const handoverTurnIdRef = useRef<string | null>(null);
  // The event stream reopened since the drop, and the wait for its replay began.
  const handoverReplayArmedRef = useRef(false);
  // When the handed-over turn is given up, the event stream never back (`HANDOVER_BACKSTOP_MS`).
  const handoverDeadlineRef = useRef(0);
  // The event stream the panel follows, set as it renders (`eventsUrl`).
  const eventsUrlRef = useRef<string | null>(null);
  // The empty bubble shown while the turn is awaited.
  const handoverPlaceholderIdRef = useRef<string | null>(null);
  // A handed-over turn given up, awaiting the read-back that says how it ended (`settleUnseenEnd`).
  const handoverEndingRef = useRef<{ from: number; shownUpTo: string | null; timer: number } | null>(null);
  const clearHandover = () => {
    if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
    handoverTimerRef.current = null;
    handoverTurnIdRef.current = null;
    handoverReplayArmedRef.current = false;
    if (handoverEndingRef.current) window.clearTimeout(handoverEndingRef.current.timer);
    handoverEndingRef.current = null;
    const placeholderId = handoverPlaceholderIdRef.current;
    handoverPlaceholderIdRef.current = null;
    if (placeholderId !== null) setMessages((prev) => prev.filter((m) => m.id !== placeholderId || m.content));
  };
  /** A turn ended provisionally: sends wait for its stored end, a while at most. */
  const startWindDown = (relayed: boolean) => {
    if (windDownRef.current) window.clearTimeout(windDownRef.current.timer);
    const token = { timer: 0, relayed };
    token.timer = window.setTimeout(() => endWindDown(token), WIND_DOWN_MS);
    windDownRef.current = token;
    setWindingDown(true);
    return token;
  };
  /** Sends go out again: *token*'s wind-down (any, without) is over. */
  const endWindDown = (token?: { timer: number; relayed: boolean }) => {
    const current = windDownRef.current;
    if (!current || (token && token !== current)) return;
    window.clearTimeout(current.timer);
    windDownRef.current = null;
    setWindingDown(false);
  };
  /** A relayed turn's wind-down is over: its stored end came, or another turn holds the conversation. */
  const endRelayedWindDown = () => {
    if (windDownRef.current?.relayed) endWindDown();
  };

  const getRequestExtrasRef = useRef(getRequestExtras);
  getRequestExtrasRef.current = getRequestExtras;
  const onStreamEventRef = useRef(onStreamEvent);
  onStreamEventRef.current = onStreamEvent;
  const onSessionEndedRef = useRef(onSessionEnded);
  onSessionEndedRef.current = onSessionEnded;
  const onConversationTitleRef = useRef(onConversationTitle);
  onConversationTitleRef.current = onConversationTitle;
  const onBeforeSendRef = useRef(onBeforeSend);
  onBeforeSendRef.current = onBeforeSend;
  const onHeldSendSettledRef = useRef(onHeldSendSettled);
  onHeldSendSettledRef.current = onHeldSendSettled;
  // Ref mirror of conversationId — always current across async boundaries
  const conversationIdRef = useRef(conversationId);
  // Ref mirror of isLoading, so the recovery probe can tell at apply time
  // whether a live turn has started owning the prompt since it was issued.
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  /**
   * The turn on screen is over, *ended* so: the one place a turn stops
   * running, which says how it ended along with it (a panel already idle
   * keeps the end it last told).
   */
  const stopRunning = (ended: ChatTurnOutcome) => {
    if (isLoadingRef.current) setTurnEnd(ended);
    isLoadingRef.current = false;
    setIsLoading(false);
    if (!noticeUntilSendRef.current) setNotice(null);
  };
  // Ref mirror of pageContext so the value sent reflects the page the user is
  // on at send time, regardless of when the send handler closure was created.
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;
  // The elements of the last host-page snapshot, by the reference the next
  // `act_on_page` action names them with (#5559).
  const pageRefsRef = useRef<Map<string, Element>>(new Map());
  const onRelativeLinkClickRef = useRef(onRelativeLinkClick);
  onRelativeLinkClickRef.current = onRelativeLinkClick;
  // A page action answers from the closure of the render that began the turn,
  // so a header rotated since would go out stale and 401 the answer.
  const requestHeadersRef = useRef(requestHeaders);
  requestHeadersRef.current = requestHeaders;
  // Conversation id as the paused turn itself reported it. The decision POST
  // needs an id, and the first turn of a fresh conversation has none yet —
  // `conversationId` is normally learned from `done`, which a paused turn has
  // by definition not reached. Kept separate from `conversationIdRef` rather
  // than adopted into it: a pause should not quietly switch on the affordances
  // (steering, history) that having an id unlocks.
  const approvalConversationIdRef = useRef<string | null>(null);
  // True when the pending prompt was recovered from the server rather than read
  // off a live stream — the turn is running, but nothing is listening to it.
  const approvalDetachedRef = useRef(false);
  // Conversations already asked about a pause, so the recovery probe runs once
  // per conversation instead of on every render that settles.
  const probedConversationRef = useRef<string | null>(null);
  // When the resume watch stops regardless of what the turn reports.
  const resumeDeadlineRef = useRef(0);
  // One session creation at a time, for the chat on screen: a new chat
  // abandons the one in flight (see `createSessionGate`).
  const [sessionGate] = useState(createSessionGate);
  // The workspace the next session is created in ("new conversation" inside
  // a workspace group). A ref for the request, state for the list to show it.
  const pendingWorkspaceRef = useRef<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  // Abort controller for in-flight file uploads (cancelled on new chat)
  const uploadAbortRef = useRef<AbortController>(new AbortController());

  // Guard invalid consumer values and keep deterministic limits.
  const effectiveMaxFileCount = Number.isFinite(maxFileCount) && maxFileCount > 0 ? Math.floor(maxFileCount) : DEFAULT_MAX_FILE_COUNT;
  const effectiveMaxTotalSize = Number.isFinite(maxTotalSize) && maxTotalSize > 0 ? maxTotalSize : DEFAULT_MAX_TOTAL_SIZE;

  // Determine message endpoint URL
  const getMessagesUrl = () => {
    if (isLegacy || apiEndpoints?.singleEndpoint) {
      return apiBaseUrl; // POST directly to base URL
    }
    return `${apiBaseUrl}${apiEndpoints?.messages ?? '/chat/messages'}`;
  };

  // A pick counts while its `@key` is in the text: editing it out drops it.
  useEffect(() => {
    setConversationRefs((prev) => pruneConversationRefs(prev, inputValue));
    setAgentMentions((prev) => pruneAgentMentions(prev, inputValue));
  }, [inputValue]);
  const addAgentMention = useCallback((mention: AgentMention) => {
    setAgentMentions((prev) => withAgentMention(prev, mention));
  }, []);

  const addConversationRef = useCallback((ref: ChatConversationRef) => {
    setConversationRefs((prev) => withConversationRef(prev, ref));
  }, []);

  /**
   * Put what a message carried back in the composer, *before* what was typed
   * since or after it; a pick the draft holds already is not added twice.
   */
  const returnToComposer = (
    { draft, files, refs, mentions }: Pick<HeldMessage, 'draft' | 'files' | 'refs' | 'mentions'>,
    { before }: { before: boolean },
  ) => {
    if (draft) setInputValue((prev) => (!prev ? draft : before ? `${draft}\n${prev}` : `${prev}\n\n${draft}`));
    if (files.length > 0) setAttachedFiles((prev) => (before ? [...files, ...prev] : [...prev, ...files]));
    if (refs.length > 0) {
      setConversationRefs((prev) => {
        const added = refs.filter((r) => !prev.some((p) => p.conversationId === r.conversationId));
        return before ? [...added, ...prev] : [...prev, ...added];
      });
    }
    if (mentions.length > 0) {
      setAgentMentions((prev) => {
        const added = mentions.filter((m) => !prev.some((p) => p.agentId === m.agentId));
        return before ? [...added, ...prev] : [...prev, ...added];
      });
    }
  };

  // Determine mid-run steering endpoint URL (null disables steering)
  const getSteerUrl = (): string | null => {
    if (isLegacy || backendType === 'ag-ui' || apiEndpoints?.singleEndpoint || apiEndpoints?.steer === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.steer ?? '/chat/messages/steer'}`;
  };

  /**
   * Determine the tool-approval endpoint URL, or null when this host has not
   * opted in.
   *
   * Unlike its siblings there is no default path — see {@link ApiEndpoints.approve}.
   * Whether this returns a URL is exactly what decides if the widget advertises
   * `supports_tool_approval`, so "configured" and "able to answer" are the same
   * fact rather than two that can drift apart.
   */
  const getApproveUrl = (): string | null => optInRoute(apiBaseUrl, apiEndpoints, backendType, 'approve');
  // Same reason as `requestHeadersRef`: the answer must resolve the route
  // against the endpoints as they are now, not as they were at turn start.
  const getApproveUrlRef = useRef(getApproveUrl);
  getApproveUrlRef.current = getApproveUrl;

  /**
   * Read what a conversation is paused on, and whether its turn is still going.
   *
   * One request serves three purposes: recovering a prompt the page never saw,
   * telling a resumed turn's watcher when to stop, and counting as the sign of
   * life that keeps a paused turn from being abandoned. Returns null on any
   * failure — every caller treats that as "learned nothing" and tries again or
   * leaves the panel as it was.
   */
  const readPendingApprovals = async (convId: string): Promise<PendingApprovalsState | null> => {
    const url = getPendingApprovalsUrl(convId);
    if (!url) return null;
    try {
      const res = await panelFetch(url, { headers: { ...(requestHeaders ?? {}) } });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        proposals: parseToolApprovalProposals(data?.proposals),
        // Anything but an explicit `running` ends the watch. A backend that
        // omits the field is one that cannot say, and waiting forever on a
        // turn nobody can report on is the worse failure.
        turnRunning: data?.turn === 'running',
      };
    } catch {
      return null;
    }
  };

  /**
   * Ask the panel to re-read the conversation from the server.
   *
   * Clearing the guard alone would not do it — the restore effect lives in the
   * panel and only re-runs when something in its dependencies changes, which is
   * what the nonce is for.
   */
  const reloadHistory = useCallback(() => {
    historyLoadedRef.current = false;
    historyReloadsRef.current += 1;
    setHistoryReloadNonce(historyReloadsRef.current);
  }, []);

  /**
   * Nothing replayed the handed-over turn, or the event stream cannot: it
   * ended out of sight, answered or not, as the conversation read back says
   * (`settleUnseenEnd`) - a turn that finished normally while the stream was
   * away is answered.
   */
  const endHandoverUnseen = () => {
    if (handoverTurnIdRef.current === null) return;
    const shownUpTo = lastStoredId(messagesRef.current);
    clearHandover();
    if (!getSessionsUrl()) {
      // As any turn ends: a Stop still awaiting its answer must not stop the next turn.
      settleTurn('stopped');
      return;
    }
    reloadHistory();
    const timer = window.setTimeout(() => {
      if (handoverEndingRef.current?.timer !== timer) return;
      handoverEndingRef.current = null;
      settleTurn('stopped');
    }, UNSEEN_END_READ_BACK_MS);
    handoverEndingRef.current = { from: historyReloadsRef.current, shownUpTo, timer };
  };
  const endHandoverUnseenRef = useRef(endHandoverUnseen);
  endHandoverUnseenRef.current = endHandoverUnseen;
  /** Wait for the event stream to reopen, until the handover's deadline at most. */
  const awaitEventStream = () => {
    if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
    handoverReplayArmedRef.current = false;
    handoverTimerRef.current = window.setTimeout(
      () => {
        handoverTimerRef.current = null;
        if (!relayedTurnRef.current) endHandoverUnseenRef.current();
      },
      Math.max(0, handoverDeadlineRef.current - Date.now()),
    );
  };
  /**
   * The event stream is open again: the handed-over turn's replay comes with
   * its snapshot, and none within {@link EVENTS_RESUME_GRACE_MS} means the
   * turn ended while the stream was away.
   */
  const awaitHandoverReplay = () => {
    if (handoverTurnIdRef.current === null || relayedTurnRef.current || handoverReplayArmedRef.current) return;
    handoverReplayArmedRef.current = true;
    if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
    handoverTimerRef.current = window.setTimeout(() => {
      handoverTimerRef.current = null;
      if (!relayedTurnRef.current) endHandoverUnseenRef.current();
    }, EVENTS_RESUME_GRACE_MS);
  };
  const awaitHandoverReplayRef = useRef(awaitHandoverReplay);
  awaitHandoverReplayRef.current = awaitHandoverReplay;
  /** The event stream dropped again before replaying the turn: the grace no longer runs, the wait for its reopening does. */
  const suspendHandoverReplay = () => {
    if (handoverTurnIdRef.current === null || relayedTurnRef.current || !handoverReplayArmedRef.current) return;
    awaitEventStream();
  };
  const suspendHandoverReplayRef = useRef(suspendHandoverReplay);
  suspendHandoverReplayRef.current = suspendHandoverReplay;

  // Determine upload endpoint URL (null disables file upload proxying)
  const getUploadUrl = (): string | null => {
    if (isLegacy || apiEndpoints?.singleEndpoint || apiEndpoints?.upload === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.upload ?? '/chat/upload'}`;
  };

  const getCancelUrl = () => optInRoute(apiBaseUrl, apiEndpoints, backendType, 'cancel');
  const getSkipWaitUrl = () => optInRoute(apiBaseUrl, apiEndpoints, backendType, 'skipWait');
  const eventsBase = optInRoute(apiBaseUrl, apiEndpoints, backendType, 'events');
  const getEventsUrl = (convId: string): string | null =>
    eventsBase ? `${eventsBase}/${encodeURIComponent(convId)}/events?client_id=${encodeURIComponent(clientId)}` : null;
  const hasEvents = !!eventsBase;
  /**
   * The pause-recovery URL for one conversation, or null when the host has
   * not exposed the route. See {@link ApiEndpoints.pendingApprovals}.
   */
  const pendingApprovalsBase = optInRoute(apiBaseUrl, apiEndpoints, backendType, 'pendingApprovals');
  const getPendingApprovalsUrl = (convId: string): string | null =>
    pendingApprovalsBase ? `${pendingApprovalsBase}/${encodeURIComponent(convId)}/pending-approvals` : null;
  /** Names this panel to a backend that relays turns, so its own are not relayed back. */
  const clientIdHeader = (): Record<string, string> => (hasEvents ? { 'X-Chat-Client-Id': clientId } : {});
  /** POST to a route about the conversation's running turn: its id, and *fields* beside it. */
  const postConversation = (url: string, convId: string, fields?: Record<string, unknown>) =>
    panelFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
      body: JSON.stringify({ conversation_id: convId, ...fields }),
    });

  // Determine sessions endpoint URL
  const getSessionsUrl = (): string | null => {
    if (isLegacy || apiEndpoints?.singleEndpoint || apiEndpoints?.sessions === null) {
      return null;
    }
    return `${apiBaseUrl}${apiEndpoints?.sessions ?? '/chat/sessions'}`;
  };

  /**
   * Update conversationId in React state, the ref mirror, and localStorage.
   * Stable identity (useCallback) so it can be used as an effect dependency.
   */
  const onConversationIdChangeRef = useRef(onConversationIdChange);
  onConversationIdChangeRef.current = onConversationIdChange;
  const updateConversationId = useCallback(
    (id: string | null, { notify = true }: { notify?: boolean } = {}) => {
      const changed = conversationIdRef.current !== id;
      conversationIdRef.current = id;
      setConversationId(id);
      if (!isControlled) writeStorage('local', conversationStorageKey, id);
      if (changed && notify) onConversationIdChangeRef.current?.(id);
    },
    [isControlled, conversationStorageKey],
  );

  /**
   * Ensure a conversation exists. Concurrent callers of the same chat (e.g.
   * multiple files selected at once) share a single session creation, and a
   * creation answered after a new chat was started resolves to `null` without
   * touching the chat that replaced it.
   */
  const ensureConversation = async (slug: string | null | undefined): Promise<string | null> => {
    // Fast path: already have one
    if (conversationIdRef.current) return conversationIdRef.current;

    // If another call is already creating, wait for it
    if (sessionGate.pending) return sessionGate.pending;

    const sessionsUrl = getSessionsUrl();
    if (!sessionsUrl) return null;

    return sessionGate.run(async (isCurrent, signal) => {
      const workspaceId = pendingWorkspaceRef.current;
      const res = await panelFetch(sessionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
        body: JSON.stringify(workspaceId ? { agent_slug: slug, workspace_id: workspaceId } : { agent_slug: slug }),
        signal,
      });
      if (!res.ok || !isCurrent()) return null;
      const data = await res.json();
      // The user started another chat meanwhile: this conversation is not
      // its, and neither is the workspace or the history guard to reset.
      if (!isCurrent()) return null;
      const convId = (data?.conversation_id as string) ?? null;
      if (convId) {
        // Just created: there is no history to restore. Left armed, the
        // panel's restore would fetch it while the first turn streams and
        // replace the answer being written with the one message persisted.
        historyLoadedRef.current = true;
        updateConversationId(convId);
        pendingWorkspaceRef.current = null;
        setPendingWorkspaceId(null);
      }
      return convId;
    });
  };

  /**
   * Upload a single file to the backend and return its file_id.
   */
  const uploadSingleFile = async (file: File, convId: string, signal: AbortSignal): Promise<string> => {
    const uploadUrl = getUploadUrl()!;
    const formData = new FormData();
    formData.append('conversation_id', convId);
    formData.append('file', file, file.name);

    const uploadHeaders = requestHeaders
      ? Object.fromEntries(
          Object.entries(requestHeaders).filter(([k]) => {
            const key = k.toLowerCase();
            return key !== 'content-type';
          }),
        )
      : undefined;

    const res = await panelFetch(uploadUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
      signal,
    });
    if (!res.ok) {
      throw new Error(`File upload failed: ${res.status}`);
    }
    const data = await res.json();
    const ids: string[] = data.file_ids ?? [];
    if (ids.length === 0) throw new Error('No file_id returned');
    return ids[0];
  };

  /**
   * Handle file selection: validate limits, add files to state immediately,
   * then upload them in the background. Each file chip shows its upload status.
   */
  const handleFileAdd = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !getUploadUrl()) return;

    // Build the list of accepted files outside the state updater (pure logic)
    const incoming = Array.from(fileList);

    // We need current state to check limits — use a ref-like approach:
    // read attachedFiles via a one-shot updater that returns prev unchanged,
    // then compute outside. Simpler: just compute optimistically and let the
    // updater do the final gating.

    // Pre-generate stable IDs and entries so side effects use the same IDs
    const candidates: { file: File; tempId: string }[] = incoming.map((file) => ({
      file,
      tempId: randomId(),
    }));

    // Update state (pure — no side effects)
    let accepted: { file: File; tempId: string }[] = [];
    setAttachedFiles((prev) => {
      const currentCount = prev.length;
      const currentSize = prev.reduce((sum, f) => sum + f.size, 0);

      const slotsAvailable = effectiveMaxFileCount - currentCount;
      if (slotsAvailable <= 0) return prev;

      let sizeLeft = effectiveMaxTotalSize - currentSize;
      const filtered: { file: File; tempId: string }[] = [];
      for (const c of candidates.slice(0, slotsAvailable)) {
        if (c.file.size <= sizeLeft) {
          filtered.push(c);
          sizeLeft -= c.file.size;
        }
      }
      if (filtered.length === 0) return prev;

      accepted = filtered;

      const newEntries: ChatFile[] = filtered.map(({ file, tempId }) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        rawFile: file,
        uploadStatus: 'pending' as const,
        fileId: tempId,
      }));

      return [...prev, ...newEntries];
    });

    // Launch uploads OUTSIDE the state updater (side effects)
    // Use setTimeout(0) to ensure state has settled after the updater
    setTimeout(() => {
      const signal = uploadAbortRef.current.signal;
      for (const { file, tempId } of accepted) {
        (async () => {
          try {
            const convId = await ensureConversation(agentSlug);
            if (!convId) {
              setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, uploadStatus: 'error' } : f)));
              return;
            }
            const fileId = await uploadSingleFile(file, convId, signal);
            setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, fileId, uploadStatus: 'done' } : f)));
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setAttachedFiles((p) => p.map((f) => (f.fileId === tempId ? { ...f, uploadStatus: 'error' } : f)));
          }
        })();
      }
    }, 0);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const { files } = e.clipboardData;
    if (files.length > 0) {
      e.preventDefault();
      handleFileAdd(files);
    }
  };

  /**
   * Mid-run steering: dispatch a message while the agent is still generating.
   * The user bubble is added optimistically and the steer endpoint is POSTed;
   * the backend persists the message and injects it into the running agentic
   * loop at the next iteration boundary. On failure (network error, or a
   * backend without steering support answering non-2xx) the optimistic bubble
   * is rolled back and what the user typed (*draft*) is restored into the
   * composer — prepended on its own line if the user already typed something
   * new — unless the host sent it (`null`), or a 409 holds it, so the message
   * is never silently lost and never resets the in-flight run state.
   */
  const steerMessage = async (
    content: string,
    files: ChatFile[],
    draft: string | null,
    shown = content,
  ): Promise<{ result: 'ok'; turnId: string | null; unanswered: boolean } | { result: 'ended' } | { result: 'failed'; detail?: string | null }> => {
    const steerUrl = getSteerUrl();
    const convId = conversationIdRef.current;
    if (!steerUrl || !convId) return { result: 'failed' };

    const optimistic = withSentText(
      { id: randomId(), role: 'user', content: shown, timestamp: new Date(), files: files.length > 0 ? files : undefined },
      content,
    );
    // Read now: by the time React runs the update, the turn may have ended.
    const openAnswerId = liveRendererRef.current?.openAnswerId() ?? handoverPlaceholderIdRef.current;
    setMessages((prev) => withUserMessageDuringTurn(prev, optimistic, openAnswerId));
    const fileIds = files.filter((f) => f.uploadStatus === 'done' && f.fileId).map((f) => f.fileId!);
    // Why the backend refused it, when it says.
    let detail: string | null = null;

    try {
      const res = await panelFetch(steerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify({ conversation_id: convId, content, agent_slug: agentSlug, ...(fileIds.length > 0 ? { file_ids: fileIds } : {}) }),
      });
      if (res.ok) {
        // Stored in the thread, whatever the body says (`stored`: handed to
        // no turn the backend can name). The turn it joined, when it says;
        // `answered: false`, no turn took it, and the next one reads it.
        const data: unknown = await res.json().catch(() => null);
        const body = data && typeof data === 'object' ? (data as { turn_id?: unknown; answered?: unknown }) : {};
        const turnId = body.turn_id;
        return { result: 'ok', turnId: typeof turnId === 'string' && turnId ? turnId : null, unanswered: body.answered === false };
      }
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      // Nothing running any more: the turn ended while this was on its way.
      // Held where the host allows it; otherwise the text goes back to the
      // composer, with no notice for an ordinary race.
      if (res.status === 409 && holdSends) return { result: 'ended' };
      if (res.status !== 409) detail = await readRefusalDetail(res);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    // A message the user typed goes back where it came from; one the host sent does not land in the composer.
    if (draft !== null) returnToComposer({ draft, files, refs: [], mentions: [] }, { before: true });
    return { result: 'failed', detail };
  };

  /**
   * Answer a turn that paused on a gated tool call.
   *
   * The decision travels the same way a steering message does — a POST beside
   * the open stream — and for the same reason: the turn is still running, so
   * the answer cannot ride on a new one. The paused turn is polling for it and
   * resumes on the stream that is already open, with no lost context.
   *
   * Deliberately not carried on the turn's own AbortController: the two are
   * independent requests, and aborting the turn must not look like a decision.
   *
   * A failure leaves the prompt on screen. The alternative — clearing it —
   * would strand the turn paused with nothing to answer it, which is the exact
   * state this whole opt-in exists to avoid.
   */
  const submitApprovalDecisions = async (decisions: ToolApprovalDecision[]) => {
    const approveUrl = getApproveUrl();
    const convId = approvalConversationIdRef.current ?? conversationIdRef.current;
    // Nothing decided is a no-op, not a failure — the prompt only submits a
    // full set, so this is unreachable from the UI.
    if (decisions.length === 0) return;
    // Missing prerequisites must be VISIBLE. The prompt is on screen, the turn
    // is paused behind it, and a silent return would leave the reviewer
    // clicking a control that does nothing — the exact failure this feature
    // exists to prevent, reintroduced at the last step. Reachable if the host
    // never named an approve path, or if a paused turn arrived without a
    // conversation id on the first turn of a fresh conversation, where the id
    // is otherwise only learned from `done`.
    if (!approveUrl || !convId) {
      setApprovalError(t('This decision could not be sent. Reload the chat and try again.'));
      return;
    }

    setApprovalError(null);
    setIsSubmittingApproval(true);
    try {
      const res = await panelFetch(approveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify({
          conversation_id: convId,
          decisions: decisions.map((d) => ({
            tool_call_id: d.toolCallId,
            decision: d.verdict,
            // Only ever sent with a rejection, and only when the reviewer
            // actually wrote something — an empty string reaches the agent as
            // a reason that says nothing.
            ...(d.verdict === 'reject' && d.rejectionReason ? { rejection_reason: d.rejectionReason } : {}),
          })),
        }),
      });
      if (res.ok) {
        setPendingApprovals(null);
        if (approvalDetachedRef.current && !relayedTurnRef.current) {
          // Answered after a reload: the turn resumes, but the stream it would
          // have reported on died with the old page. The backend persists the
          // answer and suppresses the live `done`, so re-reading the
          // conversation is the only way it can ever appear — and without this
          // the click would look like it did nothing at all.
          approvalDetachedRef.current = false;
          resumeDeadlineRef.current = Date.now() + RESUME_WATCH_MS;
          setIsResumingAfterDecision(true);
          return;
        }
        // The turn is moving again; show that immediately rather than leaving
        // the composer looking idle until the next server event lands.
        setAgentStatus((prev) => (prev ? { ...prev, status: 'thinking' } : { status: 'thinking' }));
        return;
      }
      // 409: nothing is waiting any more — the turn finished, was cancelled, or
      // somebody else answered it. Distinguished from a transient failure
      // because retrying cannot help; the stream ending clears the prompt.
      setApprovalError(
        res.status === 409 ? t('This turn is no longer waiting for a decision.') : t('Could not send your decision. Please try again.'),
      );
    } catch {
      setApprovalError(t('Could not send your decision. Please try again.'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  /**
   * Perform one `act_on_page` action on the host page and answer it with a
   * fresh snapshot (#5559). The answer goes to the approve path, which the host
   * proxies already forward; the turn waits for it on the open stream.
   *
   * A 409 means the turn no longer waits for this action (it timed out or
   * ended): nothing to retry, so it is dropped.
   */
  const answerPageAction = async (actionId: string, action: PageAction, conversationIdHint?: string) => {
    const approveUrl = getApproveUrlRef.current();
    const convId = conversationIdHint ?? conversationIdRef.current;
    if (!approveUrl || !convId || typeof document === 'undefined') return;
    // The turn's own signal: Stop, New chat and switching conversation abort it,
    // and this runs detached from the stream, so without it a stopped turn would
    // still click the page and then answer for a conversation that is gone.
    const signal = pageActionControllerRef.current?.signal;
    // The stream outlives a closed panel, so the turn is still waiting: it is
    // answered without the page and without the aborted signal, which would
    // cancel the request too and leave it waiting out its timeout per step.
    const refuse = async (error: string) => {
      try {
        await panelFetch(approveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
          body: JSON.stringify({
            conversation_id: convId,
            page_action: { action_id: actionId, ok: false, error, url: '', title: '', snapshot: '' },
          }),
        });
      } catch {
        // The turn's own page wait ends it; there is nothing to show here.
      }
    };
    if (signal?.aborted) return refuse('panel_closed');
    // The same opt-in that decides whether the capability is advertised, tested
    // again on the way in: an unsolicited frame must not read or act on the page
    // of a host that never offered it. Answered, so the turn does not hang.
    if (!hostTakesPageActions(approveUrl, onRelativeLinkClickRef.current)) {
      return refuse('page_actions_not_supported');
    }
    setAgentStatus((prev) => (prev ? { ...prev, status: 'acting_on_page' } : { status: 'acting_on_page' }));
    try {
      const result = await performPageAction(action, pageRefsRef.current, onRelativeLinkClickRef.current, document, signal);
      if (signal?.aborted) return refuse('panel_closed');
      if (action.type !== 'snapshot') await waitForDomSettle(document, { signal });
      if (signal?.aborted) return refuse('panel_closed');
      // The snapshot can throw on its own (a very deep DOM, a host
      // `getComputedStyle` that raises). It rides in `error` while `ok` stays
      // the action's own result: `ok: false` would have the agent retry a click
      // that already ran, and a field of its own would be dropped unseen by a
      // backend that does not know it, leaving an empty page and no sign why.
      let page = { text: '', url: '', title: '' };
      let snapshotError: string | null = null;
      try {
        const snapshot = takePageSnapshot(document);
        pageRefsRef.current = snapshot.refs;
        page = { text: snapshot.text, url: snapshot.url, title: snapshot.title };
      } catch (err) {
        pageRefsRef.current = new Map();
        snapshotError = `${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
      }
      await panelFetch(approveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeadersRef.current ?? {}), ...clientIdHeader() },
        signal,
        body: JSON.stringify({
          conversation_id: convId,
          page_action: {
            action_id: actionId,
            ok: result.ok,
            error: result.error ?? (snapshotError === null ? null : `snapshot_failed: ${snapshotError}`),
            url: page.url,
            title: page.title,
            snapshot: page.text,
          },
        }),
      });
    } catch {
      // The turn's own page wait ends it; there is nothing to show here.
    } finally {
      // Not for a turn that was stopped: its replacement owns the status line.
      if (!signal?.aborted) {
        setAgentStatus((prev) => (prev?.status === 'acting_on_page' ? { ...prev, status: 'thinking' } : prev));
      }
    }
  };

  /**
   * Render one turn's frames into the transcript: the turn this panel started,
   * read off its message stream, or one of another origin (a second tab, a
   * reload) relayed by the conversation's event stream. A segment closed by an
   * intermediate `done` is followed by a fresh assistant bubble.
   */
  const createTurnRenderer = (firstAssistantId: string, relayed: boolean) => {
    let currentAssistantId = firstAssistantId;
    // Every bubble the turn opened: a steered turn answers in several.
    const segmentIds = [firstAssistantId];
    let accumulated = '';
    let doneReceived = false;
    // The turn's last `done` came, with nothing written after it.
    let answered = false;
    // An error, a stop or the session's end the stream reported: what it wrote must not be put back over it.
    let ended: 'error' | 'cancelled' | 'session' | null = null;
    const ctx: ProtocolContext = { hasUsedTools: false, activeNodeId: '' };

    const deltas = createStreamDeltas((textChanged, thinking) => {
      if (textChanged) {
        // Snapshot the segment id and text: the state updater runs
        // asynchronously and `currentAssistantId` / `accumulated` may
        // already belong to the NEXT segment by then.
        const segId = currentAssistantId;
        const text = accumulated;
        setAgentStatus((prev) => ({ status: 'streaming', thinkingContent: prev?.thinkingContent }));
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text } : m)));
      }
      if (thinking) {
        setAgentStatus((prev) => ({
          ...prev,
          status: prev?.status ?? 'thinking',
          thinkingContent: (prev?.thinkingContent ?? '') + thinking,
        }));
      }
    });

    // Events after a `done` open a new segment: a steered turn answers the
    // steering message in a follow-up pass on the same stream, and each
    // segment carries its own reasoning.
    const ensureSegment = () => {
      if (!doneReceived) return;
      // Nothing of the closed segment may land in the new one.
      deltas.flush();
      doneReceived = false;
      answered = false;
      accumulated = '';
      currentAssistantId = randomId();
      segmentIds.push(currentAssistantId);
      const segmentId = currentAssistantId;
      setMessages((prev) => [...prev, { id: segmentId, role: 'assistant', content: '', timestamp: new Date() }]);
      setAgentStatus({ status: 'thinking' });
    };

    const applyStatus = (parsed: Extract<ParsedAction, { action: 'status' }>) => {
      ensureSegment();
      const segId = currentAssistantId;
      // Orthogonal to the status label below: a progress frame can carry a
      // fresh context reading whatever phase it announces.
      if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
      if (parsed.status === 'thinking_text') {
        deltas.thinking(parsed.thinkingContent ?? '');
        return;
      }
      // Every other status lands after the text and reasoning that arrived
      // before it.
      deltas.flush();
      const elapsedStartMs = typeof parsed.elapsedS === 'number' ? Date.now() - parsed.elapsedS * 1000 : undefined;
      if (parsed.resumed) {
        // A re-attached turn is replayed from its start: what it had written
        // so far arrives again, whole.
        accumulated = '';
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: '' } : m)));
        setAgentStatus({ status: 'thinking', elapsedS: parsed.elapsedS, elapsedStartMs });
      } else if (parsed.status === 'stream_retract') {
        // Rare: text that streamed as a provisional answer turned out to
        // precede tool calls — discard the answer bubble (the text re-arrives
        // as thinking_text right after, so it lands in the reasoning window).
        accumulated = '';
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: '' } : m)));
        setAgentStatus((prev) => ({ status: 'analyzing', thinkingContent: prev?.thinkingContent }));
      } else if (parsed.status === 'tool_heartbeat') {
        // Liveness signal during a long tool execution: update the elapsed
        // counter but KEEP the current status label/tools, re-anchoring the
        // local 1s ticker in ChatThinking on the server clock.
        setAgentStatus((prev) =>
          prev
            ? { ...prev, elapsedS: parsed.elapsedS, elapsedStartMs }
            : { status: 'tool_start', tools: parsed.tools, elapsedS: parsed.elapsedS, elapsedStartMs },
        );
      } else if (parsed.status === 'wait_start') {
        setAgentStatus((prev) => ({
          status: 'wait_start',
          thinkingContent: prev?.thinkingContent,
          waitSeconds: parsed.waitSeconds,
          waitReason: parsed.waitReason,
          waitStartMs: Date.now(),
        }));
      } else {
        // What a wait reports while it lasts (what it watches, a running
        // tool's progress) leaves it on screen, with its countdown and
        // "Continue now"; any other status ends it, as streamed text does.
        setAgentStatus((prev) =>
          prev?.status === 'wait_start' && STATUSES_DURING_WAIT.has(parsed.status)
            ? prev
            : { status: parsed.status, tools: parsed.tools, thinkingContent: prev?.thinkingContent },
        );
      }
    };

    const applyDone = (parsed: Extract<ParsedAction, { action: 'done' }>) => {
      deltas.flush();
      doneReceived = true;
      if (!parsed.intermediate) answered = true;
      // A completed segment cannot still be waiting on a decision, so any
      // prompt left standing (a submission that failed against a turn somebody
      // else already answered) is stale.
      setPendingApprovals(null);
      setApprovalError(null);
      applyDoneEffects(parsed, relayed);
      const segId = currentAssistantId;
      const finalContent = parsed.content || accumulated;
      // The backend stores a segment when its `done` is sent, and a restore
      // shows that time: stamping the send time instead would change the
      // footer on the next reload.
      const completedAt = new Date();
      landAnswer(segId, parsed.messageId, (m) => withDone(m, parsed, finalContent, completedAt));
    };

    /** Apply one frame; `'end'` when it closes the turn. */
    const apply = (parsed: ParsedAction): 'continue' | 'end' => {
      turnFrameSeqRef.current += 1;
      switch (parsed.action) {
        case 'status':
          applyStatus(parsed);
          return 'continue';
        case 'stream':
          ensureSegment();
          accumulated += parsed.content;
          deltas.text();
          return 'continue';
        case 'done':
          applyDone(parsed);
          // The stream of a turn this panel started ends by itself; a relayed
          // turn ends on its last segment.
          return relayed && !parsed.intermediate ? 'end' : 'continue';
        case 'approval_required':
          // The turn stops here and the stream goes silent until a decision is
          // POSTed back. Not an end state: the rest of the turn arrives on this
          // same stream afterwards, so the reasoning that led to the proposed
          // call stays on screen for the reviewer to judge it by.
          deltas.flush();
          approvalConversationIdRef.current = parsed.conversationId ?? conversationIdRef.current;
          approvalDetachedRef.current = false;
          setApprovalError(null);
          setPendingApprovals(parsed.proposals);
          setAgentStatus((prev) => (prev ? { ...prev, status: 'awaiting_approval' } : { status: 'awaiting_approval' }));
          return 'continue';
        case 'error': {
          ensureSegment();
          deltas.flush();
          const segId = currentAssistantId;
          // The backend reported a failure of its own, so the generic apology
          // rather than "check the configuration": the connection plainly worked.
          ended = 'error';
          setMessages((prev) =>
            prev.map((m) => (m.id === segId ? { ...m, content: parsed.content || t('Sorry, an error occurred. Please try again.') } : m)),
          );
          return 'end';
        }
        case 'cancelled': {
          deltas.flush();
          ended = 'cancelled';
          const segId = currentAssistantId;
          setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, stopped: true } : m)));
          return 'end';
        }
        case 'session_ended': {
          // The user is signed out: what was written stays, an empty bubble goes.
          deltas.flush();
          ended = 'session';
          const segId = currentAssistantId;
          setMessages((prev) => prev.filter((m) => !(m.id === segId && !m.content)));
          return 'end';
        }
        default:
          return 'continue';
      }
    };

    return {
      ctx,
      deltas,
      apply,
      currentAssistantId: () => currentAssistantId,
      /** The answer this turn is still writing; null between segments and once it is done. */
      openAnswerId: () => (doneReceived ? null : currentAssistantId),
      accumulated: () => accumulated,
      doneReceived: () => doneReceived,
      segmentIds: () => segmentIds,
      ended: () => ended,
      /** How the turn ended, by its frames: an `error` failed it, a stop or the session's end (even after the last `done`) or no last `done` stopped it. */
      outcome: (): ChatTurnOutcome => (ended === 'error' ? 'failed' : ended === null && answered ? 'answered' : 'stopped'),
    };
  };

  const forgetTransfer = useCallback(() => setTransferredAgent(null), []);

  /** What a `done` changes beyond its answer: the conversation's id (own turns), the context gauge, a transfer. */
  const applyDoneEffects = (parsed: DoneAction, relayed: boolean) => {
    if (parsed.conversationId && !relayed) updateConversationId(parsed.conversationId);
    // Closing reading wins: a turn whose last iteration compacted ends lower
    // than it peaked mid-run.
    if (parsed.contextUsage) setContextUsage(parsed.contextUsage);
    if (parsed.transferAgentId && parsed.transferAgentName) {
      setTransferredAgent({ id: parsed.transferAgentId, name: parsed.transferAgentName });
    }
  };

  /**
   * Give the answer bubble *bubbleId* what its turn's end says of it
   * (*land*) - unless the answer *messageId* names is on screen already (read
   * back meanwhile): the bubble then goes, so it is not shown twice.
   */
  const landAnswer = (bubbleId: string, messageId: string | undefined, land: (message: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (messageId && prev.some((m) => m.id !== bubbleId && m.serverId === messageId)) return prev.filter((m) => m.id !== bubbleId);
      return prev.map((m) => (m.id === bubbleId ? land(m) : m));
    });
  };

  /**
   * The stored end of a turn a provisional end already ended (a `done`,
   * `cancelled` or `error` carrying `message_id`): it gives the answer that
   * turn left, *bubbleId*, its persisted id - and a `done` all it carries, as a
   * live one would - and starts nothing. False when *parsed* is not that end.
   */
  const applyStoredEnd = (bubbleId: string, parsed: ParsedAction, relayed: boolean): boolean => {
    const end = turnEndOf(parsed);
    const messageId = end?.messageId;
    if (!end || !messageId) return false;
    // The context gauge and a transfer are the running turn's to say, when one runs since.
    if (end.action === 'done' && !isLoadingRef.current) applyDoneEffects(end, relayed);
    const completedAt = new Date();
    landAnswer(bubbleId, messageId, (m) =>
      end.action === 'done' ? withDone(m, end, end.content || m.content, completedAt) : { ...m, serverId: messageId, raw: end.raw ?? m.raw },
    );
    return true;
  };

  /**
   * One frame of either stream, as the panel reads it, told to the host with
   * what was read in it; `undefined` (told all the same) when it cannot be read.
   */
  const readFrame = (
    parse: (evt: Record<string, unknown>, ctx: ProtocolContext) => ParsedAction,
    evt: Record<string, unknown>,
    ctx: ProtocolContext,
    relayed: boolean,
  ): ParsedAction | undefined => {
    let parsed: ParsedAction | undefined;
    try {
      parsed = parse(evt, ctx);
    } catch {
      parsed = undefined;
    }
    askHost(onStreamEventRef.current, evt, streamEventInfo(relayed, parsed));
    if (parsed?.action === 'session_ended') askHost(onSessionEndedRef.current, parsed.reason);
    return parsed;
  };

  /** Frames about the conversation rather than a turn; true when handled. */
  const applyConversationFrame = (parsed: ParsedAction): boolean => {
    switch (parsed.action) {
      case 'user_message': {
        const relayedMessage = parsed.message;
        // Read now: by the time React runs the update, the turn may have ended.
        const openAnswerId = liveRendererRef.current?.openAnswerId() ?? handoverPlaceholderIdRef.current;
        setMessages((prev) => {
          if (relayedMessage.serverId && prev.some((m) => m.serverId === relayedMessage.serverId)) return prev;
          // This tab's own message, echoed back: it takes the persisted id rather than a second bubble.
          // Looked for among the latest messages only: an older one with the same words is another message.
          let own = prev.length - 1;
          while (own >= 0 && !(prev[own].role === 'user' && !prev[own].serverId && sentTextOf(prev[own]) === relayedMessage.content)) own -= 1;
          if (own >= 0 && prev.length - own <= 3) {
            return prev.map((m, i) => (i === own ? { ...m, serverId: relayedMessage.serverId, raw: relayedMessage.raw } : m));
          }
          return withUserMessageDuringTurn(prev, relayedMessage, openAnswerId);
        });
        return true;
      }
      case 'conversation_title':
        onConversationTitleRef.current?.(parsed.conversationId ?? conversationIdRef.current, parsed.title);
        return true;
      case 'approval_resolved':
        setPendingApprovals(null);
        setApprovalError(null);
        return true;
      default:
        return false;
    }
  };

  /**
   * The turn on screen ended and its end was seen, *outcome* so: nothing of it
   * waits any more (a Stop, the status, a decision), and the recovery probe
   * has nothing to find - on a fresh conversation too, whose id only just
   * arrived.
   */
  const settleTurn = (outcome: ChatTurnOutcome) => {
    clearCancelRequest();
    stopRunning(outcome);
    setAgentStatus(null);
    // Nothing can carry a decision any more: a prompt left up would offer an
    // answer to a question nobody is listening for.
    setPendingApprovals(null);
    setApprovalError(null);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    probedConversationRef.current = conversationIdRef.current;
  };

  const handleSendMessage = async (override?: SendOverride): Promise<ChatSendOutcome> => {
    // A host-driven or held send leaves the composer, its attachments and picks alone.
    const fromComposer = !override;
    const typed = override ? override.text : inputValue;
    const draft = fromComposer ? inputValue : (override?.draft ?? '');
    const files = fromComposer ? attachedFiles : (override?.files ?? []);
    if (!typed.trim() && files.length === 0) return 'dropped';
    const source = fromComposer ? 'composer' : (override?.source ?? 'host');
    // A turn ended provisionally and still holds the conversation (see
    // `WIND_DOWN_MS`), or one let go of with the event stream may run on (see
    // `withdrawRelayedTurn`): what is sent now waits for its end.
    const windingDownNow = !isLoadingRef.current && (windDownRef.current !== null || withdrawnTurnRef.current !== null);
    const turnRunning = isLoadingRef.current || withdrawnTurnRef.current !== null;
    // The send as the host's hook sees it while a turn runs, kept on a
    // message then held: asked again before it leaves as a new turn.
    const asked =
      !override?.decided && turnRunning && onBeforeSendRef.current
        ? { text: typed, source, extras: override?.extras, displayText: override?.displayText }
        : undefined;
    // The host's say before anything leaves: it may take the send over, or reword it.
    const decided = applySendDecision(
      typed,
      override?.decided ? undefined : askHost(onBeforeSendRef.current, { text: typed, source, turnRunning }),
      override?.displayText,
    );
    if (!decided) return 'dropped';
    noticeUntilSendRef.current = false;
    setNotice(null);
    const hookExtras = decided.extras;
    // The fields this message adds to the body: the handle's, then the hook's.
    const sendExtras = override?.extras || hookExtras ? { ...override?.extras, ...hookExtras } : undefined;
    const text = decided.text;
    // What the user's bubble shows: the host's words for it, else the text sent.
    const shownText = override?.decided ? override.displayText?.trim() || text : decided.displayText;
    // Kept on a held message only when it differs, so a plain one merges without displayText.
    const heldDisplay = shownText !== text ? shownText : undefined;
    // The picks the text still holds, when the host still offers the feature.
    const sentRefs = !fromComposer
      ? (override?.refs ?? [])
      : conversationReferencesUrl(apiBaseUrl, apiEndpoints, backendType)
        ? referencedConversations(conversationRefs, inputValue)
        : [];
    // The agents the text still mentions, in mention order.
    const sentMentions = !fromComposer ? (override?.mentions ?? []) : agentMentionsEnabled ? agentMentions : [];
    const mentionedIds = mentionedAgentIds(sentMentions, text);
    if (!text && files.length === 0) return 'dropped';
    const clearComposer = () => {
      if (!fromComposer) return;
      setInputValue('');
      setConversationRefs([]);
      setAgentMentions([]);
      setAttachedFiles([]);
    };
    if (isLoadingRef.current || windingDownNow) {
      // A file that failed to upload can neither steer nor wait: the composer
      // offers no send then (only the composer attaches files).
      if (hasFailedUpload(files)) return 'dropped';
      // Mid-run steering. References, mentions and the host's own fields never
      // steer: a steer reaches the loop as text alone, and the agent would
      // never read them. Attachments steer only where the host says the steer
      // route takes them, once uploaded.
      const uploaded = files.every((f) => f.uploadStatus === 'done');
      const canSteerThis =
        !windingDownNow &&
        !!getSteerUrl() &&
        !!conversationIdRef.current &&
        sentRefs.length === 0 &&
        mentionedIds.length === 0 &&
        Object.keys(sendExtras ?? {}).length === 0 &&
        (files.length === 0 || (steerAttachments && uploaded));
      if (canSteerThis) {
        clearComposer();
        const steered = await steerMessage(text, files, fromComposer ? draft : null, shownText);
        if (steered.result === 'ended') {
          setHeldMessage((prev) =>
            mergeHeld(prev, {
              text,
              draft,
              files,
              refs: [],
              mentions: [],
              extras: sendExtras,
              displayText: heldDisplay,
              asked,
              onSent: override?.onSent,
              onNotSent: override?.onNotSent,
            }),
          );
          return 'held';
        }
        if (steered.result === 'ok') {
          if (steered.unanswered) {
            noticeUntilSendRef.current = true;
            setNotice(t('This message will be read with your next one.'));
          }
          override?.onSteered?.(steered.turnId, steered.unanswered);
          return 'steered';
        }
        if (steered.detail) setNotice(steered.detail);
        return 'failed';
      }
      // Otherwise it waits for the turn to end, where the host allows it -
      // and always for a turn winding down, which is over on screen.
      if ((holdSends || windingDownNow) && uploaded) {
        clearComposer();
        setHeldMessage((prev) =>
          mergeHeld(prev, {
            text,
            draft,
            files,
            refs: sentRefs,
            mentions: sentMentions,
            extras: sendExtras,
            displayText: heldDisplay,
            asked,
            onSent: override?.onSent,
            onNotSent: override?.onNotSent,
          }),
        );
        return 'held';
      }
      return 'dropped';
    }

    const userMsg = withSentText(
      {
        id: randomId(),
        role: 'user',
        content: shownText,
        timestamp: new Date(),
        files: files.length > 0 ? [...files] : undefined,
        conversationRefs: sentRefs.length > 0 ? sentRefs : undefined,
      },
      text,
    );
    const assistantId = randomId();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);
    clearComposer();
    isLoadingRef.current = true;
    setIsLoading(true);
    setAgentStatus({ status: 'thinking' });
    // The chat this turn belongs to: a new chat (or a switch) moves the gate
    // on, and the turn's end must then leave the replacing chat's state alone.
    const turnGeneration = sessionGate.generation;

    const turn = createTurnRenderer(assistantId, false);
    streamDeltasRef.current = turn.deltas;
    liveRendererRef.current = turn;
    stopRequestedRef.current = false;
    ownTurnActiveRef.current = true;
    ownTurnIdRef.current = null;
    ownTurnStartedRef.current = false;
    // Set when the turn joined is already on screen from the event stream,
    // which then carries it to its end.
    let handedOver = false;
    // The backend took the message: its stream answered.
    let accepted = false;
    // The send never reached a stream: refused, or the backend unreachable.
    let failed = false;
    // The stream said the turn is over: a last `done`, an error or a stop.
    let sawTurnEnd = false;
    // The turn ended provisionally (see `cancelled`): it is over on screen,
    // and the stream is read on only for its stored end.
    let awaitingStoredEnd = false;
    // The turn's state was let go of (see `release`).
    let released = false;
    // Sends held while the stored end is awaited (see `startWindDown`).
    let windDown: ReturnType<typeof startWindDown> | null = null;
    /**
     * The stream is gone but the turn runs on, on the backend: the event stream,
     * under a new name for this panel, replays it. False when it cannot.
     */
    const handOver = (): boolean => {
      if (!hasEvents || !conversationIdRef.current || !ownTurnIdRef.current || turn.ended()) return false;
      handedOver = true;
      // The replay brings back the segment being written, never those an
      // intermediate `done` closed: they stay. Until then an empty bubble
      // says the turn is awaited.
      const placeholderId = turn.doneReceived() ? randomId() : turn.currentAssistantId();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== placeholderId),
        { id: placeholderId, role: 'assistant', content: '', timestamp: new Date() },
      ]);
      handoverPlaceholderIdRef.current = placeholderId;
      handoverTurnIdRef.current = ownTurnIdRef.current;
      ownTurnIdRef.current = null;
      setClientId(randomId());
      // A Stop on its way still says so.
      setAgentStatus((prev) => (prev?.status === 'cancelling' ? prev : { status: 'reconnecting' }));
      // The backend may be restarting: the turn is awaited for as long as the
      // event stream takes to reopen (`awaitHandoverReplay`), up to this; not
      // long when the stream has no conversation to follow yet.
      handoverDeadlineRef.current = Date.now() + (eventsUrlRef.current ? HANDOVER_BACKSTOP_MS : HANDOVER_UNFOLLOWED_MS);
      awaitEventStream();
      return true;
    };

    const controller = new AbortController();
    pageActionControllerRef.current?.abort();
    const pageActions = new AbortController();
    /** Let go of the turn's state: once, when it ends - which may be before its stream does. */
    const release = () => {
      if (released) return;
      released = true;
      turn.deltas.close();
      if (streamDeltasRef.current === turn.deltas) streamDeltasRef.current = null;
      if (liveRendererRef.current === turn) liveRendererRef.current = null;
      ownTurnActiveRef.current = false;
      // The turn is over, so its page actions are too - but only this turn's:
      // a replacement already owns the refs by then.
      if (pageActionControllerRef.current === pageActions) pageActions.abort();
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      // An abandoned turn's chat is gone: `resetChat` reset the shared
      // state already, and resetting it again here would cut the Stop button,
      // the status and the approvals of a turn the new chat started since.
      // A turn handed over to the event stream is still running.
      if (sessionGate.generation === turnGeneration && !handedOver) settleTurn(failed ? 'failed' : turn.outcome());
    };
    try {
      abortControllerRef.current = controller;
      pageActionControllerRef.current = pageActions;

      // Collect file_ids from already-uploaded files (uploaded eagerly on selection)
      const fileIds = (userMsg.files ?? []).filter((f) => f.uploadStatus === 'done' && f.fileId).map((f) => f.fileId!);

      // A conversation started inside a workspace is created first, filed
      // there: the message endpoint would create it in no workspace. Should
      // that fail (the workspace was archived or is no longer shared), the
      // message still goes, in a conversation of no workspace, rather than
      // being lost. So is one whose turns outlive their stream: Stop,
      // "Continue now" and steering name the conversation from the first turn.
      const turnsOutliveStream = !!(getCancelUrl() || getSkipWaitUrl() || hasEvents);
      if (!conversationIdRef.current && (pendingWorkspaceRef.current || turnsOutliveStream)) {
        const generation = sessionGate.generation;
        const created = await ensureConversation(agentSlug);
        // A new chat replaced this one meanwhile: the send went with it, and
        // the workspace now pending is the new chat's, not this send's.
        if (sessionGate.generation !== generation) return 'dropped';
        if (!created) {
          pendingWorkspaceRef.current = null;
          setPendingWorkspaceId(null);
        }
      }

      // Use conversationIdRef to get the latest value (may have been set by eager upload)
      const requestBody = buildRequestBody(backendType, text, {
        legacyChatId,
        conversationId: conversationIdRef.current,
        agentSlug,
        pageContext: pageContextRef.current,
        supportsToolApproval: getApproveUrl() !== null,
        referencedConversationIds: sentRefs.map((r) => r.conversationId),
        supportsPageActions: hostTakesPageActions(getApproveUrl(), onRelativeLinkClickRef.current),
        extras: { ...readRequestExtras(getRequestExtrasRef.current), ...(sendExtras ?? {}) },
      });
      if (fileIds.length > 0) {
        (requestBody as Record<string, unknown>).file_ids = fileIds;
      }
      if (mentionedIds.length > 0) {
        (requestBody as Record<string, unknown>).mentioned_agent_ids = mentionedIds;
      }

      const res = await panelFetch(getMessagesUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}), ...clientIdHeader() },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // A refusal before the stream (a rate limit, a refused option, an
        // unknown conversation) says why in its `detail`: that is what shows.
        const detail = res.ok ? null : await readRefusalDetail(res);
        failed = true;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: detail ?? t('Unable to connect. Please check the configuration.') } : m)),
        );
        return 'failed';
      }
      accepted = true;
      override?.onSent?.();

      const parseEvent = getParser(backendType);
      await readSseEvents(
        res.body,
        (evt) => {
          const parsed = readFrame(parseEvent, evt, turn.ctx, false);
          if (!parsed) return true;
          try {
            if (awaitingStoredEnd) {
              // A new chat took the panel over: nothing of this turn is on screen.
              if (sessionGate.generation !== turnGeneration) return false;
              if (applyConversationFrame(parsed)) return true;
              return !applyStoredEnd(turn.currentAssistantId(), parsed, false);
            }
            if (!ownTurnStartedRef.current && liveRendererRef.current === turn) {
              // The turn holds the conversation now: a cancel answered `none`
              // before it did goes again, to reach it (one not answered yet
              // goes again on its answer).
              ownTurnStartedRef.current = true;
              if (cancelBeforeStartRef.current === 'resend') {
                cancelBeforeStartRef.current = 'off';
                if (cancelTimerRef.current !== null) postCancel(cancelTimerRef.current);
              }
            }
            if (!ownTurnIdRef.current && typeof evt.turn_id === 'string' && evt.turn_id) ownTurnIdRef.current = evt.turn_id;
            if (parsed.action === 'folded') {
              if (parsed.turnId) ownTurnIdRef.current = parsed.turnId;
              return true;
            }
            if (applyConversationFrame(parsed)) return true;
            if (parsed.action === 'set_chat_id') {
              setLegacyChatId(parsed.chatId);
              writeStorage('local', legacyChatIdStorageKey, parsed.chatId);
              return true;
            }
            if (parsed.action === 'page_action_required') {
              turn.deltas.flush();
              // Not awaited: the stream stays silent until the answer lands,
              // and the reader must keep draining its keep-alives meanwhile.
              void answerPageAction(parsed.actionId, parsed.pageAction, parsed.conversationId);
              return true;
            }
            if (parsed.action === 'session_ended' || turnEndOf(parsed)) sawTurnEnd = true;
            if (turn.apply(parsed) !== 'end') return true;
            if (isProvisionalEnd(parsed)) {
              // Over for the user and the host now; its stored end, still to
              // come on this stream, carries the answer's id.
              turn.deltas.flush();
              awaitingStoredEnd = true;
              // A turn that outlives its stream holds the conversation until
              // that end: sends wait for it.
              if (turnsOutliveStream) windDown = startWindDown(false);

              storedEndControllerRef.current = controller;
              release();
              return true;
            }
            return false;
          } catch {
            // A frame that could not be applied is skipped, not fatal.
            return true;
          }
        },
        // Given up on, the stream is of use only when the event stream can pick the turn up.
        { idleTimeoutMs: () => (hasEvents && conversationIdRef.current && ownTurnIdRef.current ? SSE_IDLE_TIMEOUT_MS : undefined) },
      );
      turn.deltas.flush();
      // Ended without saying the turn is over (a proxy's idle timeout, a
      // server restart): the turn may well run on.
      if (!handedOver && !sawTurnEnd && handOver()) return 'sent';
      if (!handedOver && !turn.ended() && turn.accumulated() && !turn.doneReceived()) {
        const segId = turn.currentAssistantId();
        const text = turn.accumulated();
        setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: text || t('No response.') } : m)));
      }
    } catch (err) {
      // A frame still pending would land after the error below, or in the
      // chat that replaced an aborted stream.
      turn.deltas.close();
      // Only the stored end was still awaited: the turn itself is over.
      if (released) return 'sent';
      if (err instanceof DOMException && err.name === 'AbortError') return accepted ? 'sent' : 'dropped';
      const segId = turn.currentAssistantId();
      // The stream dropped mid-turn, but the backend runs the turn on.
      if (handOver()) return 'sent';
      if (!accepted) failed = true;
      setMessages((prev) => prev.map((m) => (m.id === segId ? { ...m, content: t('Sorry, an error occurred. Please try again.') } : m)));
    } finally {
      release();
      if (windDown) endWindDown(windDown);
      if (storedEndControllerRef.current === controller) storedEndControllerRef.current = null;
    }
    return accepted ? 'sent' : 'failed';
  };

  /** End the relayed turn on screen, if any, as its own stream would. */
  const endRelayedTurn = () => {
    const relayedTurn = relayedTurnRef.current;
    if (!relayedTurn) return;
    relayedTurnRef.current = null;
    relayedTurn.renderer.deltas.flush();
    relayedTurn.renderer.deltas.close();
    if (streamDeltasRef.current === relayedTurn.renderer.deltas) streamDeltasRef.current = null;
    if (liveRendererRef.current === relayedTurn.renderer) liveRendererRef.current = null;
    const segId = relayedTurn.renderer.currentAssistantId();
    setMessages((prev) => prev.filter((m) => !(m.id === segId && !m.content && !m.stopped)));
    settleTurn(relayedTurn.renderer.outcome());
  };

  const endRelayedTurnRef = useRef(endRelayedTurn);
  endRelayedTurnRef.current = endRelayedTurn;

  /**
   * Let go of the relayed turn on screen, the event stream closed: reopened,
   * it replays the segment being written, which goes; those an intermediate
   * `done` closed stay, and the replay reads back the ones closed meanwhile.
   * The turn may run on: it is still running for sends and for the host (see
   * `withdrawnTurnRef`) until the reopened stream replays it or shows it over.
   */
  const withdrawRelayedTurn = () => {
    const relayedTurn = relayedTurnRef.current;
    if (!relayedTurn) return;
    const unfinished = relayedTurn.renderer.doneReceived() ? null : relayedTurn.renderer.currentAssistantId();
    endRelayedTurn();
    setWithdrawnTurn({ turnId: relayedTurn.turnId, shownUpTo: lastStoredId(messagesRef.current) });
    if (unfinished) setMessages((prev) => prev.filter((m) => m.id !== unfinished));
  };
  const withdrawRelayedTurnRef = useRef(withdrawRelayedTurn);
  withdrawRelayedTurnRef.current = withdrawRelayedTurn;

  /** The relayed turn let go of with the event stream is over, *ended* so when its end said. */
  const endWithdrawnTurn = (ended?: ChatTurnOutcome) => {
    if (!withdrawnTurnRef.current) return;
    setWithdrawnTurn(null);
    if (ended) setTurnEnd(ended);
  };
  const endWithdrawnTurnRef = useRef(endWithdrawnTurn);
  endWithdrawnTurnRef.current = endWithdrawnTurn;

  const clearResumeWait = () => {
    if (resumeWaitRef.current) window.clearTimeout(resumeWaitRef.current.timer);
    resumeWaitRef.current = null;
  };

  /**
   * The relayed turn on screen, or the one let go of, ended out of sight:
   * nothing replayed it, or the event stream cannot reopen. It still runs for
   * sends and the host until the conversation read back says how it ended
   * (`settleUnseenEnd`), {@link UNSEEN_END_READ_BACK_MS} at most; a replay
   * meanwhile carries it on.
   */
  const endTurnUnseen = () => {
    clearResumeWait();
    const relayedTurn = relayedTurnRef.current;
    if (relayedTurn) {
      // What it wrote stays until the read-back brings what it stored.
      const shownUpTo = lastStoredId(messagesRef.current);
      endRelayedTurn();
      setWithdrawnTurn({ turnId: relayedTurn.turnId, shownUpTo });
    }
    const withdrawn = withdrawnTurnRef.current;
    if (!withdrawn || withdrawn.readBack) return;
    if (!getSessionsUrl()) {
      endWithdrawnTurn('stopped');
      return;
    }
    reloadHistory();
    const timer = window.setTimeout(() => {
      if (withdrawnTurnRef.current === withdrawn) endWithdrawnTurn('stopped');
    }, UNSEEN_END_READ_BACK_MS);
    withdrawn.readBack = { from: historyReloadsRef.current, timer };
  };
  const endTurnUnseenRef = useRef(endTurnUnseen);
  endTurnUnseenRef.current = endTurnUnseen;

  /**
   * The conversation read back for the *readFor*-th `reloadHistory` (*restored*;
   * `null`: it could not be read): a turn that ended out of sight ends, as
   * the read-back says (`unseenTurnOutcome`).
   */
  const settleUnseenEnd = (readFor: number, restored: ChatMessage[] | null) => {
    const ending = handoverEndingRef.current;
    if (ending && readFor >= ending.from) {
      window.clearTimeout(ending.timer);
      handoverEndingRef.current = null;
      settleTurn(restored ? unseenTurnOutcome(restored, ending.shownUpTo) : 'stopped');
    }
    const withdrawn = withdrawnTurnRef.current;
    if (!withdrawn?.readBack || readFor < withdrawn.readBack.from) return;
    endWithdrawnTurn(restored ? unseenTurnOutcome(restored, withdrawn.shownUpTo) : 'stopped');
  };

  /**
   * The event stream reopened (it ends every so often, or dropped), or the
   * page that let go of a relayed turn shows again: that turn is still running
   * only if the stream's snapshot replays it, which it does at once. Otherwise
   * it ended while the stream was away, and its end is only in the history.
   * A turn let go of waits from the page showing again, however often the
   * stream reopens since.
   */
  const awaitRelayedResume = () => {
    const relayedTurn = relayedTurnRef.current;
    const withdrawn = withdrawnTurnRef.current;
    if (!relayedTurn && withdrawn && (withdrawn.readBack || resumeWaitRef.current?.turn === withdrawn)) return;
    clearResumeWait();
    const awaited = relayedTurn ?? withdrawn;
    if (!awaited) return;
    const timer = window.setTimeout(() => {
      resumeWaitRef.current = null;
      if (relayedTurn ? relayedTurnRef.current !== relayedTurn : withdrawnTurnRef.current !== withdrawn) return;
      endTurnUnseen();
    }, EVENTS_RESUME_GRACE_MS);
    resumeWaitRef.current = { turn: awaited, timer };
  };
  const awaitRelayedResumeRef = useRef(awaitRelayedResume);
  awaitRelayedResumeRef.current = awaitRelayedResume;

  const mergeTurnHistory = (restored: ChatMessage[]): boolean => {
    const renderer = turnReadBackRef.current;
    turnReadBackRef.current = null;
    // The panel's own turn started since: the read-back waits for it, as any.
    if (!renderer || ownTurnActiveRef.current) return false;
    const turnIds = new Set(renderer.segmentIds());
    const liveId = renderer.currentAssistantId();
    setMessages((prev) => mergeIntoTurn(prev, restored, turnIds, liveId));
    return true;
  };

  // The frame types the event stream sent without `turn_id`, said once each.
  const unnamedTurnFramesRef = useRef(new Set<string>());
  const warnUnnamedTurnFrame = (type: string) => {
    if (unnamedTurnFramesRef.current.has(type)) return;
    unnamedTurnFramesRef.current.add(type);
    console.warn(
      `A "${type}" frame of the event stream names no turn and is not read: the events route needs \`turn_id\` on every turn frame (see "Turns that outlive their stream" in the README)`,
    );
  };
  /** One frame of the conversation's event stream. */
  const handleEventFrame = (evt: Record<string, unknown>) => {
    let relayedTurn = relayedTurnRef.current;
    const parsed = readFrame(parseRestEvent, evt, relayedTurn?.renderer.ctx ?? { hasUsedTools: false, activeNodeId: '' }, true);
    if (!parsed) return;
    if (applyConversationFrame(parsed)) return;
    if (parsed.action === 'session_ended') {
      // Signed out: no turn of another origin goes on for this user, and a
      // handed-over turn of our own will not be replayed.
      endRelayedTurn();
      endWithdrawnTurn('stopped');
      if ((handoverTurnIdRef.current !== null || handoverEndingRef.current !== null) && !ownTurnActiveRef.current) {
        clearHandover();
        settleTurn('stopped');
      }
      return;
    }
    if (!TURN_ACTIONS.has(parsed.action)) return;
    // Every turn frame of the event stream names its turn: one naming none is not read.
    const turnId = typeof evt.turn_id === 'string' && evt.turn_id ? evt.turn_id : null;
    if (!turnId) {
      warnUnnamedTurnFrame(String(evt.type));
      return;
    }
    // A turn a provisional end already ended (never the panel's own turn):
    // its stored end gives the answer it left its id, and nothing of it
    // reopens the turn.
    const provisionalBubble = provisionalEndsRef.current.get(turnId);
    if (provisionalBubble !== undefined) {
      if (applyStoredEnd(provisionalBubble, parsed, true)) {
        provisionalEndsRef.current.delete(turnId);
        endRelayedWindDown();
      }
      return;
    }
    // The turn this panel streams itself is never rendered twice.
    if (ownTurnActiveRef.current || turnId === ownTurnIdRef.current) return;
    if (turnId === stoppedTurnIdRef.current) return;
    const awaited = resumeWaitRef.current;
    if (awaited) {
      // The first turn frame since the stream reopened says whether the turn
      // on screen still runs.
      clearResumeWait();
      if (relayedTurn && relayedTurn === awaited.turn && turnId !== relayedTurn.turnId) {
        // Another turn runs: this one ended while the stream was away, and
        // the read-back brings its stored answer in place of the one it was
        // writing.
        const unfinished = relayedTurn.renderer.doneReceived() ? null : relayedTurn.renderer.currentAssistantId();
        endRelayedTurn();
        if (unfinished) setMessages((prev) => prev.filter((m) => m.id !== unfinished));
        reloadHistory();
        relayedTurn = null;
      } else if (relayedTurn && relayedTurn === awaited.turn) {
        // Otherwise it is replayed (`thinking.resumed`), having run on all
        // along: the snapshot brings back the segment being written, which
        // the ack resets, never those an intermediate `done` closed. Those
        // closed while the stream was away are only in the history, read
        // back into the turn (`mergeTurnHistory`).
        turnReadBackRef.current = relayedTurn.renderer;
        reloadHistory();
      }
    }

    let current = relayedTurn;
    if (current && current.turnId !== turnId) {
      endRelayedTurn();
      current = null;
    }
    if (!current) {
      // A turn let go of with the event stream goes on here, or another runs:
      // it ended while the stream was away, and its answer is in the history.
      const withdrawn = withdrawnTurnRef.current;
      const replayed = withdrawn?.turnId === turnId;
      // This panel's own turn, awaited since its stream dropped, goes on here
      // even from its end alone (a restart cut it): the end is applied as a
      // relayed turn's, its stored end awaited when it is provisional.
      const handedOver = turnId === handoverTurnIdRef.current;
      // The end of a turn never seen begins nothing.
      if ((parsed.action === 'cancelled' || parsed.action === 'error') && !replayed && !handedOver) {
        if (withdrawn) endTurnUnseen();
        return;
      }
      if (withdrawn && !replayed) {
        endWithdrawnTurn();
        reloadHistory();
      }
      const bubbleId = randomId();
      setMessages((prev) => [...prev, { id: bubbleId, role: 'assistant', content: '', timestamp: new Date() }]);
      current = { turnId, renderer: createTurnRenderer(bubbleId, true) };
      relayedTurnRef.current = current;
      // Another turn holds the conversation: one winding down is gone.
      endRelayedWindDown();

      streamDeltasRef.current = current.renderer.deltas;
      liveRendererRef.current = current.renderer;
      // A turn this panel lost sight of (its own stream dropped, the event
      // stream closed while the page was hidden), replayed: the segments it
      // closed meanwhile are only in the history, read back into it.
      setWithdrawnTurn(null);
      const lostSight = handedOver || replayed;
      if (evt.resumed === true && lostSight) {
        turnReadBackRef.current = current.renderer;
        reloadHistory();
      } else if (handedOver && (parsed.action === 'cancelled' || parsed.action === 'error')) {
        // What the cut turn stored (its interrupted reply) is in the history.
        reloadHistory();
      }
      clearHandover();
      stopRequestedRef.current = false;
      isLoadingRef.current = true;
      setIsLoading(true);
      setAgentStatus({ status: 'thinking' });
    }
    if (current.renderer.apply(parsed) === 'end') {
      if (isProvisionalEnd(parsed)) {
        // Its stored end is still to come, and the backend holds the
        // conversation until then: sends wait for it.
        const ends = provisionalEndsRef.current;
        ends.set(current.turnId, current.renderer.currentAssistantId());
        while (ends.size > PROVISIONAL_ENDS_KEPT) ends.delete(ends.keys().next().value!);
        startWindDown(true);
      }
      endRelayedTurn();
    }
  };
  const handleEventFrameRef = useRef(handleEventFrame);
  handleEventFrameRef.current = handleEventFrame;

  const handleNewChat = (workspaceId?: string) => resetChat(workspaceId, true);

  /** Let go of the message held, if any: the host hears it goes nowhere. */
  const cancelHeld = () => {
    const held = heldMessageRef.current;
    if (held) {
      onHeldSendSettledRef.current?.(held.text, 'cancelled');
      tellNotSent(held.parts);
    }
    setHeldMessage(null);
  };

  /** The new-chat reset; *notify*: the host hears of the empty conversation (not on a switch, which names the next one). */
  const resetChat = (workspaceId: string | undefined, notify: boolean) => {
    // A string only: the header and the sidebar pass this as a click handler,
    // and the click event must never reach the session request.
    const workspace = typeof workspaceId === 'string' && workspaceId ? workspaceId : null;
    pendingWorkspaceRef.current = workspace;
    setPendingWorkspaceId(workspace);
    // Nothing of the abandoned stream may land in the fresh chat.
    streamDeltasRef.current?.close();
    streamDeltasRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pageActionControllerRef.current?.abort();
    pageActionControllerRef.current = null;
    // Cancel any in-flight file uploads
    uploadAbortRef.current.abort();
    uploadAbortRef.current = new AbortController();
    // A session still being created was the abandoned chat's.
    sessionGate.abandon();
    relayedTurnRef.current?.renderer.deltas.close();
    relayedTurnRef.current = null;
    clearResumeWait();
    turnReadBackRef.current = null;
    setWithdrawnTurn(null);
    provisionalEndsRef.current.clear();
    // The abandoned chat's own stream, read on for a stored end, goes too.
    storedEndControllerRef.current?.abort();
    storedEndControllerRef.current = null;
    endWindDown();
    ownTurnActiveRef.current = false;
    cancelHeld();
    clearCancelRequest();
    clearHandover();
    noticeUntilSendRef.current = false;
    stopRunning('stopped');
    setMessages([]);
    setInputValue('');
    setConversationRefs([]);
    setAgentMentions([]);
    setAttachedFiles([]);
    setAgentStatus(null);
    setTransferredAgent(null);
    // A fresh (or newly selected) conversation starts with no known occupancy;
    // the restore or the first turn fills it back in. Carrying the previous
    // conversation's reading over would be a plain lie.
    setContextUsage(null);
    setPendingApprovals(null);
    setApprovalError(null);
    setIsResumingAfterDecision(false);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    // Re-arm the probe: the conversation being switched to may well be paused.
    probedConversationRef.current = null;
    historyLoadedRef.current = false;
    if (isLegacy) {
      setLegacyChatId(null);
      writeStorage('local', legacyChatIdStorageKey, null);
    } else {
      updateConversationId(null, { notify });
    }
  };

  const clearPendingWorkspace = (workspaceId: string) => {
    if (pendingWorkspaceRef.current !== workspaceId) return;
    pendingWorkspaceRef.current = null;
    setPendingWorkspaceId(null);
  };

  const handleSwitchConversation = (id: string) => {
    if (!isLegacy && id === conversationIdRef.current) return;
    // Reuse the full new-chat reset (abort in-flight request + uploads,
    // clear transcript/composer/status), then adopt the selected id and
    // re-arm the history-restore effect so the host panel fetches the
    // conversation's messages via the sessions endpoint. The host hears of
    // the conversation switched to alone, never of an empty one between.
    resetChat(undefined, false);
    if (!isLegacy) {
      updateConversationId(id);
      // `resetChat` blanked the composer; bring back this conversation's
      // own unsent draft, if any, with its references.
      const draft = loadDraftState(storageKeyPrefix, id);
      setInputValue(draft.text);
      setConversationRefs(draft.refs);
    }
  };

  const clearCancelRequest = () => {
    if (cancelTimerRef.current !== null) window.clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
    cancelBeforeStartRef.current = 'off';
    stopContextRef.current = null;
  };

  /**
   * Let go of the turn on screen without the backend's word that it ended.
   * *running*: a turn was on screen, whose answer then says it was stopped.
   */
  const stopLocally = (running = true) => {
    clearCancelRequest();
    const live = liveRendererRef.current;
    liveRendererRef.current = null;
    const relayedTurn = relayedTurnRef.current;
    const stoppedTurnId = relayedTurn?.turnId ?? handoverTurnIdRef.current;
    if (stoppedTurnId) stoppedTurnIdRef.current = stoppedTurnId;
    clearHandover();
    // The text that arrived before the stop stays on screen, including what the
    // next frame would have applied; nothing after it does.
    streamDeltasRef.current?.flush();
    streamDeltasRef.current?.close();
    streamDeltasRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pageActionControllerRef.current?.abort();
    pageActionControllerRef.current = null;
    relayedTurnRef.current = null;
    stopRunning('stopped');
    setAgentStatus(null);
    // Stopping IS the way out of a pause the reviewer does not want to answer:
    // the backend waits indefinitely by design, so abandoning the stream is
    // the client's only other move.
    setPendingApprovals(null);
    setApprovalError(null);
    setIsResumingAfterDecision(false);
    approvalConversationIdRef.current = null;
    approvalDetachedRef.current = false;
    pageRefsRef.current = new Map();
    // The answer being written says it was stopped, whatever it got to; an
    // earlier empty one (before a steer) goes.
    const segId = running ? live?.currentAssistantId() : undefined;
    setMessages((prev) =>
      prev.map((m) => (m.id === segId ? { ...m, stopped: true } : m)).filter((m) => !(m.role === 'assistant' && !m.content && !m.stopped)),
    );
  };

  /**
   * Stop the turn. A backend whose turns outlive their stream (`cancel` route)
   * is asked to stop it and ends the stream with `cancelled`; without that
   * route, or should it not answer, the panel lets go of the stream itself.
   */
  const handleStopGenerating = () => {
    const withdrawn = withdrawnTurnRef.current;
    if (!isLoadingRef.current && withdrawn) {
      // A turn let go of with the event stream: the backend is told, and its
      // replay is not shown.
      const cancelUrl = getCancelUrl();
      const convId = conversationIdRef.current;
      if (cancelUrl && convId) void postConversation(cancelUrl, convId).catch(() => undefined);
      stoppedTurnIdRef.current = withdrawn.turnId;
      stopRequestedRef.current = true;
      clearResumeWait();
      endWithdrawnTurn('stopped');
      return;
    }
    if (!isLoadingRef.current) {
      stopLocally(false);
      return;
    }
    stopRequestedRef.current = true;
    const cancelUrl = getCancelUrl();
    const convId = conversationIdRef.current;
    // A turn awaited from the event stream has no stream of its own to end with
    // `cancelled`: the backend is told, and the panel lets go at once.
    const awaitingHandover = handoverTurnIdRef.current !== null && !relayedTurnRef.current;
    if (!cancelUrl || !convId || awaitingHandover) {
      if (cancelUrl && convId) void postConversation(cancelUrl, convId).catch(() => undefined);
      stopLocally();
      return;
    }
    if (cancelTimerRef.current !== null) return;
    noticeUntilSendRef.current = false;
    setNotice(null);
    setPendingApprovals(null);
    setApprovalError(null);
    setAgentStatus((prev) => ({ ...prev, status: 'cancelling' }));
    const timer = window.setTimeout(() => stopLocally(), CANCEL_GRACE_MS);
    cancelTimerRef.current = timer;
    // Put back should the backend refuse the Stop: the turn then goes on.
    stopContextRef.current = { statusBefore: agentStatus, approvalsBefore: pendingApprovals, frameSeq: turnFrameSeqRef.current };
    postCancel(timer);
  };

  /**
   * Ask the backend to end the turn, for the Stop of *timer*. Sent again once
   * the panel's own turn starts when it went before and was answered `none`
   * (see `cancelBeforeStartRef`): asking twice ends one turn.
   */
  const postCancel = (timer: number) => {
    const cancelUrl = getCancelUrl();
    const convId = conversationIdRef.current;
    if (!cancelUrl || !convId) return;
    // The panel's own send has not started its turn yet: the backend may
    // answer that none runs, and start it right after. `awaiting_send` says
    // so, and the backend may keep the Stop for that send.
    const beforeStart = ownTurnActiveRef.current && !ownTurnStartedRef.current;
    if (beforeStart) cancelBeforeStartRef.current = 'asked';
    // Still this Stop's to settle: the turn has not ended meanwhile.
    const pending = () => cancelTimerRef.current === timer;
    postConversation(cancelUrl, convId, beforeStart ? { awaiting_send: true } : undefined)
      .then(async (res) => {
        if (res.ok) {
          const data: unknown = await res.json().catch(() => null);
          if (!pending()) return;
          const none = !!data && typeof data === 'object' && (data as { turn?: unknown }).turn === 'none';
          if (beforeStart) {
            // Said before the own turn started: `none` says nothing of that
            // turn, which the cancel sent again once it starts reaches; any
            // other answer reached a turn, and nothing goes again.
            if (!none) cancelBeforeStartRef.current = 'off';
            else if (!ownTurnStartedRef.current) cancelBeforeStartRef.current = 'resend';
            else {
              cancelBeforeStartRef.current = 'off';
              postCancel(timer);
            }
            return;
          }
          if (!none) return;
          // No turn was running anywhere: no `cancelled` will come. The turn
          // may have ended as this was on its way, its end not read yet: what
          // it stored is read back.
          stopLocally();
          reloadHistory();
          return;
        }
        // Refused (a turn the backend cannot reach right now): it runs on, and the user is told why.
        const detail = await readRefusalDetail(res);
        if (!pending()) return;
        const before = stopContextRef.current;
        clearCancelRequest();
        stopRequestedRef.current = false;
        // The status as it was, unless a frame of the turn came since: then
        // the turn's own, with its label back if it still says `cancelling`.
        setAgentStatus((prev) => {
          if (prev?.status !== 'cancelling') return prev;
          if (before && turnFrameSeqRef.current === before.frameSeq) return before.statusBefore;
          return { ...prev, status: before?.statusBefore?.status ?? 'thinking' };
        });
        if (before?.approvalsBefore) setPendingApprovals((prev) => prev ?? before.approvalsBefore);
        setNotice(detail ?? t('The response could not be stopped. Try again.'));
      })
      .catch(() => {
        if (pending()) stopLocally();
      });
  };

  const skipWaitUrl = getSkipWaitUrl();
  const skipWait = async () => {
    const url = getSkipWaitUrl();
    const convId = conversationIdRef.current;
    if (!url || !convId) return;
    try {
      const res = await postConversation(url, convId);
      if (res.ok) setAgentStatus((prev) => (prev?.status === 'wait_start' ? { status: 'thinking', thinkingContent: prev.thinkingContent } : prev));
    } catch {
      // The wait ends on its own; the button stays for another try.
    }
  };

  /**
   * Follow the conversation's event stream (`events` route): turns started
   * elsewhere (another tab, a reload mid-turn, a second device), user
   * messages sent there, new titles and approvals answered there. Reconnects
   * with backoff while the page is visible; a route refused outright stops it.
   * Closed once the page has been hidden for {@link EVENTS_HIDDEN_CLOSE_MS};
   * shown again, the stream reopens (its snapshot replays a turn still
   * running) and the conversation is read back for what ended meanwhile: a
   * relayed turn it let go of and does not replay within
   * {@link EVENTS_RESUME_GRACE_MS} of the page showing, or that a refusal
   * keeps from reopening, ended (`endTurnUnseen`).
   * A refusal of the credentials (401, 403) is tried once more each time the
   * host's `requestHeaders` change, so a refreshed token picks the stream up.
   */
  const eventsUrl = conversationId && historySettledFor === conversationId ? getEventsUrl(conversationId) : null;
  // Whether a dropped turn can be followed on the event stream (`handOver`).
  eventsUrlRef.current = eventsUrl;
  const headersKey = requestHeadersKey(requestHeaders);
  const headersKeyRef = useRef(headersKey);
  headersKeyRef.current = headersKey;
  // The stream refused for its credentials: its URL and the headers it was refused with.
  const [eventsRefused, setEventsRefused] = useState<{ url: string; headersKey: string } | null>(null);
  const [eventsReopen, setEventsReopen] = useState(0);
  useEffect(() => {
    if (!eventsRefused || eventsRefused.url !== eventsUrl || eventsRefused.headersKey === headersKey) return;
    setEventsRefused(null);
    setEventsReopen((n) => n + 1);
  }, [eventsRefused, eventsUrl, headersKey]);
  useEffect(() => {
    if (!eventsUrl) return;
    let stopped = false;
    let connected = false;
    let retry = 0;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let hiddenTimer: number | null = null;
    // Opened at least once: a stream not followed since then missed frames.
    let opened = false;
    // Frames were missed while the page was hidden: the reopened stream comes
    // with a read-back of the conversation.
    let missed = false;

    const connect = async () => {
      timer = null;
      if (stopped || connected) return;
      if (document.visibilityState === 'hidden') {
        if (opened) missed = true;
        return;
      }
      connected = true;
      controller = new AbortController();
      let refused = false;
      let openedAt: number | null = null;
      try {
        const sentHeadersKey = headersKeyRef.current;
        const res = await panelFetch(eventsUrl, {
          headers: { ...(requestHeadersRef.current ?? {}), 'X-Chat-Client-Id': clientId },
          signal: controller.signal,
        });
        if ([401, 403, 404, 405].includes(res.status)) {
          refused = true;
          if ((res.status === 401 || res.status === 403) && !stopped) setEventsRefused({ url: eventsUrl, headersKey: sentHeadersKey });
          // Nothing replays a relayed or handed-over turn now: how it ended is read back.
          if (!stopped) {
            endTurnUnseenRef.current();
            endHandoverUnseenRef.current();
          }
          return;
        }
        if (!res.ok || !res.body) {
          // Only a backend coming back (a gateway between it and the panel says so) is worth waiting for.
          if (!stopped && ![502, 503, 504].includes(res.status)) endHandoverUnseenRef.current();
          return;
        }
        if (opened) awaitRelayedResumeRef.current();
        awaitHandoverReplayRef.current();
        opened = true;
        openedAt = Date.now();
        await readSseEvents(
          res.body,
          (evt) => {
            // A stream that delivers is healthy: its next drop, or the server's
            // own end of it, is retried from the shortest delay again.
            retry = 0;
            try {
              handleEventFrameRef.current(evt);
            } catch {
              // A frame that could not be applied is skipped, not fatal.
            }
          },
          { idleTimeoutMs: SSE_IDLE_TIMEOUT_MS },
        );
      } catch {
        // Dropped or aborted: reconnected below unless the effect is gone.
      } finally {
        connected = false;
        // A handed-over turn the stream had not replayed yet waits for its next reopening.
        if (openedAt !== null && !stopped) suspendHandoverReplayRef.current();
        // So is one that lived a while, keep-alives only: one that opens and
        // closes at once is not, and backs off.
        if (openedAt !== null && Date.now() - openedAt >= EVENTS_HEALTHY_MS) retry = 0;
        if (!stopped && !refused && !missed) {
          const delay = Math.min(EVENTS_RETRY_MAX_MS, EVENTS_RETRY_BASE_MS * 2 ** retry);
          retry += 1;
          timer = window.setTimeout(() => void connect(), delay * (0.5 + Math.random() / 2));
        }
      }
    };
    // Hidden long enough, the stream is let go of, and with it the relayed
    // turn it fed: the reopened stream replays that turn if it still runs.
    const closeWhileHidden = () => {
      hiddenTimer = null;
      if (stopped || document.visibilityState !== 'hidden') return;
      missed = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      controller?.abort();
      withdrawRelayedTurnRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimer === null) hiddenTimer = window.setTimeout(closeWhileHidden, EVENTS_HIDDEN_CLOSE_MS);
        return;
      }
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      hiddenTimer = null;
      if (document.visibilityState !== 'visible') return;
      // A turn let go of while hidden ran on only if the stream replays it
      // soon, whether or not the stream reopens.
      if (withdrawnTurnRef.current) awaitRelayedResumeRef.current();
      if (connected) return;
      if (timer !== null) window.clearTimeout(timer);
      retry = 0;
      if (missed) {
        missed = false;
        // What ended while the stream was closed is only in the history.
        reloadHistory();
      }
      void connect();
    };
    void connect();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // A relayed turn nothing feeds any more is over, as far as this panel can tell.
      endRelayedTurnRef.current();
      endWithdrawnTurnRef.current();
    };
  }, [eventsUrl, clientId, eventsReopen, reloadHistory]);

  // Held messages given back to the composer, told to the host once the
  // composer shows them (`getDraft` reads it then).
  const returnedRef = useRef<string[]>([]);
  const [returnedTick, setReturnedTick] = useState(0);
  const settleReturned = (text: string) => {
    returnedRef.current.push(text);
    setReturnedTick((n) => n + 1);
  };
  useEffect(() => {
    for (const text of returnedRef.current.splice(0)) onHeldSendSettledRef.current?.(text, 'returned');
  }, [returnedTick]);

  // The turn is over, and no longer holds the conversation (see
  // `WIND_DOWN_MS`): what was held goes out as the next one.
  useEffect(() => {
    if (isLoading || turnWithdrawn) return;
    if (stopRequestedRef.current) {
      // A Stop is over with its turn: it says nothing of a later send, which
      // goes out once the turn winds down.
      stopRequestedRef.current = false;
      if (heldMessage) {
        // Stopped: the user takes back what they typed rather than see it go;
        // a host's send is not theirs to take back, and goes nowhere.
        setHeldMessage(null);
        tellNotSent(heldMessage.parts);
        if (!heldMessage.draft && heldMessage.files.length === 0) {
          onHeldSendSettledRef.current?.(heldMessage.text, 'dropped');
          return;
        }
        settleReturned(heldMessage.text);
        returnToComposer(heldMessage, { before: true });
        return;
      }
    }
    if (windingDown || !heldMessage) return;
    setHeldMessage(null);
    // Told once: as the backend takes it, or as it fails or goes nowhere. Held
    // again behind a turn started meanwhile, it is told when that one ends.
    let told = false;
    const tell = (outcome: ChatHeldOutcome) => {
      if (told) return;
      told = true;
      onHeldSendSettledRef.current?.(heldMessage.text, outcome);
    };
    // Each send the host's hook decided while a turn ran is asked again, the
    // turn over, before the message leaves as a new one. One it takes over
    // gives back to the composer what the user typed for it, after what they
    // typed since.
    const kept: HeldPart[] = [];
    const takenOver: HeldPart[] = [];
    for (const part of heldMessage.parts) {
      const { asked } = part;
      if (!asked) {
        kept.push(part);
        continue;
      }
      const decision = applySendDecision(
        asked.text,
        askHost(onBeforeSendRef.current, { text: asked.text, source: asked.source, turnRunning: false, held: true }),
        asked.displayText,
      );
      if (!decision) {
        takenOver.push(part);
        continue;
      }
      kept.push({
        ...part,
        text: decision.text,
        displayText: decision.displayText !== decision.text ? decision.displayText : undefined,
        extras: asked.extras || decision.extras ? { ...asked.extras, ...decision.extras } : undefined,
        asked: undefined,
      });
    }
    tellNotSent(takenOver);
    const givenBack = takenOver.filter((part) => part.draft || part.files.length > 0);
    for (const part of givenBack) returnToComposer(part, { before: false });
    if (kept.length === 0) {
      if (givenBack.length > 0) settleReturned(heldMessage.text);
      else tell('dropped');
      return;
    }
    const { text, draft, files, refs, mentions, extras, displayText } = heldMessageOf(kept);
    void handleSendMessageRef
      .current({
        text,
        draft,
        files,
        refs,
        mentions,
        extras,
        displayText,
        decided: true,
        onSent: () => {
          tell('sent');
          for (const part of kept) askHost(part.onSent);
        },
        onNotSent: () => tellNotSent(kept),
      })
      .then(
        (outcome) => {
          if (outcome === 'held') return;
          const sent = outcome === 'sent' || outcome === 'steered';
          tell(sent ? 'sent' : outcome === 'failed' ? 'failed' : 'dropped');
          if (!sent) tellNotSent(kept);
        },
        () => {
          tell('failed');
          tellNotSent(kept);
        },
      );
  }, [isLoading, turnWithdrawn, windingDown, heldMessage]);

  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  // Persist the composer draft against the conversation it belongs to. Writing
  // an empty value removes the entry, so sending (which blanks the composer)
  // also clears the draft — no explicit cleanup needed at the send sites.
  useEffect(() => {
    const id = window.setTimeout(() => {
      persistDraft(storageKeyPrefix, conversationId, inputValue, conversationRefs);
    }, DRAFT_PERSIST_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [inputValue, conversationId, conversationRefs, storageKeyPrefix]);

  // A panel closed mid-stream has no state left for the stream's frames to
  // update. Its page actions stop, so a hover fallback cannot click the host
  // page after the panel closed; the stream itself runs on, which is how its
  // answer is in history when the panel reopens.
  useEffect(
    () => () => {
      streamDeltasRef.current?.close();
      pageActionControllerRef.current?.abort();
      // The own stream read on for a stored end has no panel left to give it to.
      storedEndControllerRef.current?.abort();
      if (windDownRef.current) window.clearTimeout(windDownRef.current.timer);

      if (handoverTimerRef.current !== null) window.clearTimeout(handoverTimerRef.current);
      if (handoverEndingRef.current) window.clearTimeout(handoverEndingRef.current.timer);
      if (resumeWaitRef.current) window.clearTimeout(resumeWaitRef.current.timer);
      // A message still held goes nowhere with the panel.
      cancelHeld();
    },
    [],
  );

  // Flush the pending draft on unmount. Hosts unmount the panel the instant it
  // is closed, which would otherwise drop anything typed inside the debounce
  // window — exactly the keystrokes the draft exists to protect.
  const draftFlushRef = useRef({ conversationId, inputValue, conversationRefs });
  draftFlushRef.current = { conversationId, inputValue, conversationRefs };
  useEffect(
    () => () => {
      const { conversationId: id, inputValue: value, conversationRefs: refs } = draftFlushRef.current;
      persistDraft(storageKeyPrefix, id, value, refs);
    },
    [],
  );

  /**
   * Recover a prompt the page never saw, or lost to a reload.
   *
   * `approval_required` is one event on one stream: reload while it is showing
   * and the panel holds nothing — not even the `tool_call_id`s a decision has
   * to name — while the turn goes on waiting for an answer that can no longer
   * be given. Asked once per conversation; an empty list is the ordinary
   * answer, and the whole probe is best-effort, since a host that has not
   * exposed the route simply keeps the pre-recovery behaviour.
   *
   * Skipped while a turn is live: that prompt arrives on the stream, and the
   * stream is the more current of the two.
   */
  useEffect(() => {
    const convId = conversationId;
    if (!convId || isLoading) return;
    if (probedConversationRef.current === convId) return;
    // Recovering a prompt there is no way to answer would only strand the
    // reviewer differently, so both routes have to be configured.
    const url = getPendingApprovalsUrl(convId);
    if (!url || !getApproveUrl()) return;
    probedConversationRef.current = convId;

    (async () => {
      // Best-effort: a failure leaves the panel exactly as it was, which is the
      // pre-recovery behaviour.
      const state = await readPendingApprovals(convId);
      if (!state?.proposals) return;
      // Validate at apply time against the live refs rather than dropping the
      // response on effect teardown — the same reasoning as the panel's
      // history restore. A StrictMode double-invoke or a host re-render tears
      // this effect down while the request is in flight without the
      // conversation having changed, and a teardown flag would discard the
      // recovery in exactly the case it is needed. Only a genuinely superseded
      // response is dropped: another conversation, or a live turn that has
      // since started and will carry its own prompt.
      if (conversationIdRef.current !== convId || isLoadingRef.current) return;
      approvalConversationIdRef.current = convId;
      approvalDetachedRef.current = true;
      setApprovalError(null);
      setPendingApprovals(state.proposals);
    })();
    // Keyed on the conversation and whether a turn is live; the endpoint
    // getters read current props on each run and must not re-trigger a probe.
  }, [conversationId, isLoading]);

  /**
   * Keep a recovered prompt answerable for as long as it is displayed.
   *
   * Only for prompts recovered after a reload: a live one is held open by its
   * own stream, which vouches for the reviewer on its own. Re-reading the
   * pending approvals is the lightest request that counts as a sign of life,
   * and its result is deliberately ignored — this is a heartbeat, not a poll,
   * and a prompt that has since gone stale is better answered with the 409 the
   * reviewer can see than made to vanish under them.
   */
  useEffect(() => {
    if (!pendingApprovals?.length || !approvalDetachedRef.current) return;
    const convId = approvalConversationIdRef.current;
    const url = convId ? getPendingApprovalsUrl(convId) : null;
    if (!url) return;
    const id = window.setInterval(() => {
      panelFetch(url, { headers: { ...(requestHeaders ?? {}) } }).catch(() => {
        /* A missed heartbeat is survivable: the next one is well inside the
           server's window. */
      });
    }, APPROVAL_PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(id);
    // Re-armed whenever the prompt itself changes; the endpoint getter reads
    // current props on each run.
  }, [pendingApprovals]);

  /**
   * Watch a turn resumed by a decision made on a recovered prompt.
   *
   * The turn has no stream left to announce itself on, so its state is read
   * from the pause-recovery route: keep watching while it reports `running`,
   * and re-read the conversation once — the answer is there — when it reports
   * idle. Polling that route rather than the transcript is what makes the stop
   * condition definite instead of a guess, and it keeps the turn alive as a
   * side effect.
   *
   * A resumed turn can also pause *again* on a second gated call. With no
   * stream, this poll is the only way that prompt could ever reach the user, so
   * finding proposals puts the panel straight back into deciding.
   */
  useEffect(() => {
    if (!isResumingAfterDecision) return;
    const convId = approvalConversationIdRef.current;
    if (!convId) {
      setIsResumingAfterDecision(false);
      return;
    }
    if (Date.now() >= resumeDeadlineRef.current) {
      // Backstop only, for a turn-state marker that never clears. Re-read once
      // on the way out so a finished answer still lands.
      setIsResumingAfterDecision(false);
      reloadHistory();
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(async () => {
      const state = await readPendingApprovals(convId);
      if (cancelled) return;
      if (!state) {
        // Learned nothing — a transient failure. Try again rather than
        // declaring a running turn finished.
        setResumeTick((n) => n + 1);
        return;
      }
      if (state.proposals) {
        approvalDetachedRef.current = true;
        setApprovalError(null);
        setPendingApprovals(state.proposals);
        setIsResumingAfterDecision(false);
        return;
      }
      if (!state.turnRunning) {
        setIsResumingAfterDecision(false);
        reloadHistory();
        return;
      }
      setResumeTick((n) => n + 1);
    }, RESUME_POLL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [isResumingAfterDecision, resumeTick, reloadHistory]);

  // Steering affordances are only advertised when the typed text can actually
  // be dispatched mid-run: a response is streaming (isLoading), the REST steer
  // endpoint is configured, and the conversation already has a server id (the
  // very first turn of a fresh conversation only receives its id on `done`).
  const canSteer = isLoading && getSteerUrl() !== null && conversationId !== null;

  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    turnRunning: isLoading || turnWithdrawn,
    sendsHeld: !isLoading && (windingDown || turnWithdrawn),
    turnEnd,
    agentStatus,
    attachedFiles,
    conversationId,
    contextUsage,
    transferredAgent,
    forgetTransfer,
    canSteer,
    pendingApprovals,
    isSubmittingApproval,
    approvalError,
    submitApprovalDecisions,
    isResumingAfterDecision,
    historyReloadNonce,
    historyLoadedRef,
    conversationIdRef,
    handleFileAdd,
    handlePaste,
    handleSendMessage,
    skipWait: skipWaitUrl ? skipWait : null,
    readPendingApprovals: pendingApprovalsBase ? readPendingApprovals : null,
    heldMessage,
    notice,
    cancelHeldMessage: cancelHeld,
    reloadHistory,
    mergeTurnHistory,
    settleUnseenEnd,
    agentMentions,
    addAgentMention,
    handleNewChat,
    pendingWorkspaceId,
    clearPendingWorkspace,
    handleStopGenerating,
    conversationRefs,
    addConversationRef,
    setAttachedFiles,
    setMessages,
    setContextUsage,
    updateConversationId,
    handleSwitchConversation,
  };
}
