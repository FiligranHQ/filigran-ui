/**
 * How the panel tells that the user's session ended: a `401` whose body's
 * `detail.code` is `session_expired` (a stream says it with a
 * `session_expired` frame, read by the protocol parser).
 */

const SESSION_EXPIRED = 'session_expired';

/** The session's end a refusal body states, with its `reason`; null for any other body. */
export function refusalSessionEnd(body: unknown): { reason: string | undefined } | null {
  if (!body || typeof body !== 'object') return null;
  const detail = (body as Record<string, unknown>).detail;
  if (!detail || typeof detail !== 'object') return null;
  const { code, reason } = detail as Record<string, unknown>;
  if (code !== SESSION_EXPIRED) return null;
  return { reason: typeof reason === 'string' && reason ? reason : undefined };
}

/**
 * `fetch`, reporting each `401` whose body says the session ended to what
 * *reporter* returns (when it returns nothing, no body is read). The body is
 * read from a clone, so the caller reads the response as it would have.
 */
export function watchSessionEnd(reporter: () => ((reason: string | undefined) => void) | undefined): typeof fetch {
  return async (input, init) => {
    // Looked up per call: a test, or a host's polyfill, may replace it later.
    const res = await globalThis.fetch(input, init);
    const report = res.status === 401 ? reporter() : undefined;
    if (report && typeof res.clone === 'function') {
      const copy = res.clone();
      void copy
        .json()
        .then((body: unknown) => {
          const end = refusalSessionEnd(body);
          if (end) report(end.reason);
        })
        .catch(() => undefined);
    }
    return res;
  };
}
