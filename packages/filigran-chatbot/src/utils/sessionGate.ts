/**
 * The session request of the chat on screen.
 *
 * Creating the conversation is one request shared by every caller of the
 * same chat - several files selected at once, then the send - and it belongs
 * to that chat alone. A new chat (or a switch to another conversation)
 * abandons it: its answer must not become the new chat's conversation, clear
 * the new chat's workspace, or release the request the new chat has started
 * since. `abandon()` moves the chat on; a request reads `isCurrent()` after
 * each await and leaves everything alone once it is false.
 *
 * Kept free of local runtime imports so `node --test` runs it as is.
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
  run(request: (isCurrent: () => boolean) => Promise<string | null>): Promise<string | null>;
  /** A new chat: the request in flight, if any, is no longer its. */
  abandon(): void;
}

export function createSessionGate(): SessionGate {
  let generation = 0;
  let pending: Promise<string | null> | null = null;
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
      const promise = request(() => started === generation).catch(() => null);
      pending = promise;
      // Released once settled, and only while it is still this request's:
      // after a new chat the next request may hold it already.
      void promise.finally(() => {
        if (pending === promise) pending = null;
      });
      return promise;
    },
    abandon() {
      generation += 1;
      pending = null;
    },
  };
}
