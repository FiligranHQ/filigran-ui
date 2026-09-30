import { useCallback, useInsertionEffect, useRef, useState } from 'react';
import type { ChatMessage, MessageFeedback, Translate } from '../types';
import { normalizeFeedbackComment, ratingOf, submitFeedback } from '../utils/feedback';

/** What the user did to one answer's rating in this session. */
export interface FeedbackEntry {
  /** Identifies the last change: a request answered after a newer one is ignored. */
  seq: number;
  value: MessageFeedback | null;
  comment: string | null;
  /** A request is on its way; the thumbs wait for it. */
  pending: boolean;
  /** The translated reason the last request failed, shown under the answer. */
  error: string | null;
  /** The optional comment asked for after a thumbs down. */
  commentOpen: boolean;
}

/**
 * The key an answer's rating is kept under. Not `id` alone: a restore renames
 * every row (`restored-<n>`), and one runs right after the first turn of a new
 * conversation - the persisted id is what stays the same.
 */
export const feedbackKeyOf = (msg: ChatMessage): string => msg.serverId ?? msg.id;

interface Options {
  /** `{apiBaseUrl}{feedback}` when the panel stores ratings itself (`feedbackBaseUrl`). */
  feedbackUrl?: string | null;
  conversationId?: string | null;
  requestHeaders?: Record<string, string>;
  onMessageFeedback?: (messageId: string, feedback: MessageFeedback | null, message: ChatMessage) => void;
  t: Translate;
}

/**
 * The thumbs of every answer in the transcript. A rating shows at once and is
 * taken back if the backend refuses it; the callbacks keep their identity, so
 * the memoized rows do not re-render when the panel does.
 *
 * Every action is handed the answer's current entry by its row: a click is a
 * discrete event, so the row has rendered the previous one's outcome by then.
 */
export function useMessageFeedback({ feedbackUrl, conversationId, requestHeaders, onMessageFeedback, t }: Options) {
  const [state, setState] = useState<{ scope: string | null | undefined; entries: Record<string, FeedbackEntry> }>(() => ({
    scope: conversationId,
    entries: {},
  }));
  // Ratings belong to one conversation: another one starts from none, and a
  // request of the previous one answering late finds no entry to update.
  let entries = state.entries;
  if (state.scope !== conversationId) {
    entries = {};
    setState({ scope: conversationId, entries });
  }

  const latest = useRef({ feedbackUrl, conversationId, requestHeaders, onMessageFeedback, t });
  useInsertionEffect(() => {
    latest.current = { feedbackUrl, conversationId, requestHeaders, onMessageFeedback, t };
  });
  const seqRef = useRef(0);

  const put = useCallback((key: string, entry: FeedbackEntry) => setState((s) => ({ ...s, entries: { ...s.entries, [key]: entry } })), []);
  const patch = useCallback(
    (key: string, seq: number, change: (entry: FeedbackEntry) => FeedbackEntry) =>
      setState((s) => {
        const entry = s.entries[key];
        if (!entry || entry.seq !== seq) return s;
        return { ...s, entries: { ...s.entries, [key]: change(entry) } };
      }),
    [],
  );

  const rate = useCallback(
    async (msg: ChatMessage, next: MessageFeedback | null, current: FeedbackEntry | undefined) => {
      const { feedbackUrl: url, conversationId: convId, requestHeaders: headers, onMessageFeedback: notify, t: tr } = latest.current;
      const key = feedbackKeyOf(msg);
      const seq = ++seqRef.current;
      if (!url) {
        // The host stores it: nothing to wait for.
        put(key, { seq, value: next, comment: null, pending: false, error: null, commentOpen: false });
        notify?.(key, next, msg);
        return;
      }
      if (!convId || !msg.serverId) return;
      put(key, { seq, value: next, comment: null, pending: true, error: null, commentOpen: false });
      const stored = await submitFeedback(fetch, url, convId, msg.serverId, next ? { rating: ratingOf(next), comment: null } : null, headers);
      if (!stored) {
        const error = tr(next ? 'Could not submit feedback.' : 'Could not retract feedback.');
        patch(key, seq, () =>
          current
            ? { ...current, seq, pending: false, commentOpen: false, error }
            : { seq, value: null, comment: null, pending: false, error, commentOpen: false },
        );
        return;
      }
      // A thumbs down is worth a word on what went wrong - asked once it is
      // stored, so skipping the question loses nothing.
      patch(key, seq, (entry) => ({ ...entry, pending: false, commentOpen: next === 'down' }));
      latest.current.onMessageFeedback?.(key, next, msg);
    },
    [put, patch],
  );

  const saveComment = useCallback(
    async (msg: ChatMessage, text: string, current: FeedbackEntry) => {
      const { feedbackUrl: url, conversationId: convId, requestHeaders: headers, t: tr } = latest.current;
      const key = feedbackKeyOf(msg);
      const comment = normalizeFeedbackComment(text);
      if (!url || !convId || !msg.serverId || !comment) {
        put(key, { ...current, commentOpen: false, error: null });
        return;
      }
      const seq = ++seqRef.current;
      put(key, { ...current, seq, pending: true, error: null });
      const stored = await submitFeedback(fetch, url, convId, msg.serverId, { rating: 'negative', comment }, headers);
      patch(key, seq, (entry) =>
        stored
          ? { ...entry, comment, pending: false, commentOpen: false }
          : // The question stays open with what was typed, to try again.
            { ...entry, pending: false, error: tr('Could not submit feedback.') },
      );
    },
    [put, patch],
  );

  const skipComment = useCallback(
    (msg: ChatMessage, current: FeedbackEntry) => put(feedbackKeyOf(msg), { ...current, commentOpen: false, error: null }),
    [put],
  );

  return { entries, rate, saveComment, skipComment };
}
