import { useCallback, useEffect, useState } from 'react';
import type { ApiEndpoints, BackendType, ChatPromptTemplate, ChatQuotaStatus } from '../types';

interface UseComposerExtrasOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
}

interface UseComposerExtrasReturn {
  /** Null while unavailable — the toolbar then omits the affordance entirely. */
  prompts: ChatPromptTemplate[] | null;
  quota: ChatQuotaStatus | null;
  /** Re-read the quota after a turn completes, so the indicator stays honest. */
  refreshQuota: () => void;
}

/** Defensive parse: an unexpected payload yields no prompts rather than a crash. */
function parsePrompts(data: unknown): ChatPromptTemplate[] {
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.prompts)
      ? ((data as Record<string, unknown>).prompts as unknown[])
      : [];
  const out: ChatPromptTemplate[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const id = typeof p.id === 'string' ? p.id : '';
    const content = typeof p.content === 'string' ? p.content : '';
    // A prompt with nothing to insert is not worth listing.
    if (!id || !content) continue;
    out.push({
      id,
      title: typeof p.title === 'string' && p.title ? p.title : id,
      content,
      description: typeof p.description === 'string' ? p.description : undefined,
    });
  }
  return out;
}

function parseQuota(data: unknown): ChatQuotaStatus | null {
  if (!data || typeof data !== 'object') return null;
  const q = data as Record<string, unknown>;
  if (typeof q.used !== 'number') return null;
  return {
    used: q.used,
    // Explicitly nullable: absent and null both mean "no ceiling".
    limit: typeof q.limit === 'number' ? q.limit : null,
    period: typeof q.period === 'string' ? q.period : '',
  };
}

/**
 * Fetches the two data-driven composer toolbar items: the prompt library and
 * the quota indicator.
 *
 * Both are opt-in by configuration rather than by a mode flag — a host that
 * does not serve the route (or sets it to null) simply gets no affordance, so
 * the UI can never advertise something the backend cannot answer. Neither is
 * available on the legacy / ag-ui backends or in single-endpoint mode, which
 * have no route to carry them.
 */
export function useComposerExtras({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  requestHeaders,
}: UseComposerExtrasOptions): UseComposerExtrasReturn {
  const [prompts, setPrompts] = useState<ChatPromptTemplate[] | null>(null);
  const [quota, setQuota] = useState<ChatQuotaStatus | null>(null);

  const restLike = backendType === 'rest' && !apiEndpoints?.singleEndpoint;
  const promptsPath = apiEndpoints?.prompts === undefined ? '/chat/prompts' : apiEndpoints.prompts;
  const quotaPath = apiEndpoints?.quota === undefined ? '/chat/quota' : apiEndpoints.quota;
  const promptsUrl = restLike && promptsPath ? `${apiBaseUrl}${promptsPath}` : null;
  const quotaUrl = restLike && quotaPath ? `${apiBaseUrl}${quotaPath}` : null;

  useEffect(() => {
    if (!promptsUrl) {
      setPrompts(null);
      return;
    }
    let cancelled = false;
    fetch(promptsUrl, { credentials: 'include', headers: { ...(requestHeaders ?? {}) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        // A failed or empty fetch leaves the affordance hidden rather than
        // showing an empty menu the user cannot act on.
        const parsed = data === null ? [] : parsePrompts(data);
        setPrompts(parsed.length > 0 ? parsed : null);
      })
      .catch(() => {
        if (!cancelled) setPrompts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [promptsUrl, requestHeaders]);

  const [quotaNonce, setQuotaNonce] = useState(0);
  const refreshQuota = useCallback(() => setQuotaNonce((n) => n + 1), []);

  useEffect(() => {
    if (!quotaUrl) {
      setQuota(null);
      return;
    }
    let cancelled = false;
    fetch(quotaUrl, { credentials: 'include', headers: { ...(requestHeaders ?? {}) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setQuota(parseQuota(data));
      })
      .catch(() => {
        if (!cancelled) setQuota(null);
      });
    return () => {
      cancelled = true;
    };
  }, [quotaUrl, requestHeaders, quotaNonce]);

  return { prompts, quota, refreshQuota };
}
