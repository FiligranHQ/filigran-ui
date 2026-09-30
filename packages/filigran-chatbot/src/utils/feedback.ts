import type { ApiEndpoints, BackendType, ChatMessagePersistedFeedback, MessageFeedback } from '../types';

/**
 * Persisted feedback on an assistant answer: the requests the thumbs send.
 * A stored rating is read back by `parsePersistedFeedback` with the rest of a
 * session restore (`hooks/protocols/parseRestEvent.ts`).
 *
 * Kept free of local runtime imports so `node --test` runs it as is.
 */

/** Longest comment the feedback endpoint stores. */
export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;

export type FeedbackRating = ChatMessagePersistedFeedback['rating'];

export const ratingOf = (value: MessageFeedback): FeedbackRating => (value === 'up' ? 'positive' : 'negative');

export const feedbackValueOf = (rating: FeedbackRating): MessageFeedback => (rating === 'positive' ? 'up' : 'down');

/**
 * How the thumbs of one answer work, or null when it shows none:
 * - `persisted`: the panel stores the rating (`ApiEndpoints.feedback`), which
 *   needs the conversation and the answer's persisted id - an answer the
 *   backend did not identify cannot be rated;
 * - `callback`: the host stores it (`onMessageFeedback` alone).
 */
export type FeedbackMode = 'persisted' | 'callback';

export function feedbackModeOf(
  serverId: string | undefined,
  feedbackUrl: string | null | undefined,
  conversationId: string | null | undefined,
  hasCallback: boolean,
): FeedbackMode | null {
  if (feedbackUrl) return conversationId && serverId ? 'persisted' : null;
  return hasCallback ? 'callback' : null;
}

/** The rating shown on an answer, and whether it can still be changed. */
export function shownFeedback(
  session: { value: MessageFeedback | null } | undefined,
  stored: ChatMessagePersistedFeedback | undefined,
): { value: MessageFeedback | null; locked: boolean } {
  // Rated in this session: the session's answer wins, and can be changed.
  if (session) return { value: session.value, locked: false };
  // Rated before the conversation was reopened: shown, and final.
  if (stored) return { value: feedbackValueOf(stored.rating), locked: true };
  return { value: null, locked: false };
}

/** A comment as the endpoint stores it: trimmed, capped, and null when empty. */
export function normalizeFeedbackComment(comment: string | null | undefined): string | null {
  const trimmed = (comment ?? '').trim();
  return trimmed ? trimmed.slice(0, FEEDBACK_COMMENT_MAX_LENGTH) : null;
}

/**
 * `{apiBaseUrl}{feedback}`, or null when the panel does not store feedback
 * itself: the path is unset (no default, see `ApiEndpoints.feedback`), the
 * backend is not the REST one, or every request goes to one endpoint.
 */
export function feedbackBaseUrl(apiBaseUrl: string, apiEndpoints: ApiEndpoints | undefined, backendType: BackendType): string | null {
  if (backendType !== 'rest' || apiEndpoints?.singleEndpoint || !apiEndpoints?.feedback) return null;
  return `${apiBaseUrl}${apiEndpoints.feedback}`;
}

/**
 * The request that stores (`rating`) or retracts (`null`) the user's rating
 * of one message.
 */
export function feedbackRequest(
  baseUrl: string,
  conversationId: string,
  messageId: string,
  rating: { rating: FeedbackRating; comment: string | null } | null,
  requestHeaders?: Record<string, string>,
): { url: string; init: RequestInit } {
  const url = `${baseUrl}/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`;
  if (!rating) {
    return { url, init: { method: 'DELETE', credentials: 'include', headers: { ...requestHeaders } } };
  }
  return {
    url,
    init: {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...requestHeaders },
      body: JSON.stringify({ rating: rating.rating, comment: normalizeFeedbackComment(rating.comment) }),
    },
  };
}

/** The part of `fetch` the feedback request needs. */
export type FeedbackFetch = (url: string, init: RequestInit) => Promise<{ ok: boolean }>;

/**
 * Sends one `feedbackRequest` and says whether the backend stored it. A network
 * failure is a refusal like any other status: the caller rolls the thumbs back
 * either way.
 */
export async function submitFeedback(
  fetchImpl: FeedbackFetch,
  baseUrl: string,
  conversationId: string,
  messageId: string,
  rating: { rating: FeedbackRating; comment: string | null } | null,
  requestHeaders?: Record<string, string>,
): Promise<boolean> {
  const { url, init } = feedbackRequest(baseUrl, conversationId, messageId, rating, requestHeaders);
  try {
    return (await fetchImpl(url, init)).ok;
  } catch {
    return false;
  }
}
