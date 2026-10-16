import { useEffect, useState } from 'react';
import {
  EMPTY_REFERENCE_SEARCH,
  REFERENCE_SEARCH_DEBOUNCE_MS,
  parseReferenceCandidates,
  referenceSearchUrl,
  type ReferenceSearchState,
} from '../utils/conversationRefs';

interface UseConversationReferenceSearchOptions {
  /** `conversationReferencesUrl(...)`: null while the feature is off. */
  url: string | null;
  /** The text typed after `@`, or null while no `@` is being typed. */
  query: string | null;
  /** The conversation written in, left out of the answer. */
  exclude?: string | null;
  requestHeaders?: Record<string, string>;
}

/**
 * The conversations the `@` menu offers for the text typed after `@`.
 *
 * Searched once the text has rested `REFERENCE_SEARCH_DEBOUNCE_MS`. A request
 * overtaken by the next keystroke is aborted, and its answer, should it land
 * anyway, is dropped: only the latest text is ever answered. The previous
 * answer stays until then, so typing never empties the menu.
 */
export function useConversationReferenceSearch({ url, query, exclude, requestHeaders }: UseConversationReferenceSearchOptions): ReferenceSearchState {
  const [state, setState] = useState<ReferenceSearchState>(EMPTY_REFERENCE_SEARCH);

  useEffect(() => {
    if (!url || query === null) {
      // A menu opened later starts from nothing, not from an old answer.
      setState(EMPTY_REFERENCE_SEARCH);
      return;
    }
    let current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(referenceSearchUrl(url, query, exclude), {
          credentials: 'include',
          headers: { ...(requestHeaders ?? {}) },
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : null;
        if (!current) return;
        setState(res.ok ? { query, items: parseReferenceCandidates(data), failed: false } : { query, items: [], failed: true });
      } catch {
        if (current) setState({ query, items: [], failed: true });
      }
    }, REFERENCE_SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [url, query, exclude, requestHeaders]);

  return state;
}
