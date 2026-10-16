/**
 * The one session request of the chat on screen. A new chat abandons it: the
 * request is aborted, and `isCurrent()` turns false so a late answer touches
 * nothing. No local runtime imports, so `node --test` runs it as is.
 */
export interface SessionGate {
  /** Which chat is on screen; compare two readings to tell whether it changed. */
  readonly generation: number;
  /** The session request in flight for the chat on screen, if any. */
  readonly pending: Promise<string | null> | null;
  /**
   * Join the chat's request, or start it. A request that fails resolves to
   * `null`, like one abandoned.
   */
  run(request: (isCurrent: () => boolean, signal: AbortSignal) => Promise<string | null>): Promise<string | null>;
  /** A new chat: the request in flight, if any, is aborted and no longer its. */
  abandon(): void;
}

export function createSessionGate(): SessionGate {
  let generation = 0;
  let pending: Promise<string | null> | null = null;
  let controller: AbortController | null = null;
  return {
    get generation() {
      return generation;
    },
    get pending() {
      return pending;
    },
    run(request) {
      if (pending) return pending;
      const started = generation;
      const own = new AbortController();
      controller = own;
      const promise = request(() => started === generation, own.signal).catch(() => null);
      pending = promise;
      // Released once settled, and only while it is still this request's:
      // after a new chat the next request may hold it already.
      void promise.finally(() => {
        if (pending === promise) pending = null;
        if (controller === own) controller = null;
      });
      return promise;
    },
    abandon() {
      generation += 1;
      pending = null;
      // The backend would otherwise still create the abandoned conversation,
      // filed in the workspace it was started in.
      controller?.abort();
      controller = null;
    },
  };
}
