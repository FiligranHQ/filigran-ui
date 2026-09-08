import { useEffect, useState } from 'react';
import type { ApiEndpoints, BackendType } from '../types';

interface UseAgentSuggestionsOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
  /** Selected agent; suggestions are re-fetched whenever it changes. */
  agentSlug: string | null | undefined;
}

interface UseAgentSuggestionsReturn {
  /** Null when unavailable — the caller then falls back to its own list. */
  suggestions: string[] | null;
  loading: boolean;
}

/** Accepts a bare array or `{ suggestions: [...] }`, and drops non-strings. */
function parseSuggestions(data: unknown): string[] {
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.suggestions)
      ? ((data as Record<string, unknown>).suggestions as unknown[])
      : [];
  return rawList
    .map((s) => {
      if (typeof s === 'string') return s.trim();
      // Tolerate `{ label }` / `{ prompt }` objects: an "action suggestion"
      // is likely to grow fields, and a richer payload should not blank the
      // welcome screen for older clients.
      if (s && typeof s === 'object') {
        const o = s as Record<string, unknown>;
        const v = o.prompt ?? o.label ?? o.text;
        if (typeof v === 'string') return v.trim();
      }
      return '';
    })
    .filter((s) => s.length > 0);
}

/**
 * Suggested opening actions for the selected agent.
 *
 * Fetched per agent so the welcome screen changes when you switch — which is
 * also the confirmation that the switch took effect. Generic today; the
 * endpoint is the seam through which they can become per-user later without
 * touching this package.
 *
 * Returns null (rather than an empty list) whenever the route is unavailable
 * or answers nothing usable, so the caller can fall back to its own
 * `promptSuggestions` instead of rendering an empty section.
 */
export function useAgentSuggestions({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  requestHeaders,
  agentSlug,
}: UseAgentSuggestionsOptions): UseAgentSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const restLike = backendType === 'rest' && !apiEndpoints?.singleEndpoint;
  const path = apiEndpoints?.suggestions === undefined ? '/chat/suggestions' : apiEndpoints.suggestions;
  const baseUrl = restLike && path ? `${apiBaseUrl}${path}` : null;

  useEffect(() => {
    if (!baseUrl) {
      setSuggestions(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // The agent is a query parameter rather than a path segment: a backend
    // that ignores it still answers with its generic set, which is exactly the
    // "generic today, personalised later" progression.
    const url = agentSlug ? `${baseUrl}?agent_slug=${encodeURIComponent(agentSlug)}` : baseUrl;
    fetch(url, { credentials: 'include', headers: { ...(requestHeaders ?? {}) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const parsed = data === null ? [] : parseSuggestions(data);
        setSuggestions(parsed.length > 0 ? parsed : null);
      })
      .catch(() => {
        if (!cancelled) setSuggestions(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, agentSlug, requestHeaders]);

  return { suggestions, loading };
}
