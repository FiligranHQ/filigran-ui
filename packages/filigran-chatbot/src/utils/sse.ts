/** Why a stream that kept itself alive was given up: it fell silent. */
export class SseStreamSilentError extends Error {
  constructor() {
    super('the event stream fell silent');
    this.name = 'SseStreamSilentError';
  }
}

/**
 * Read the `data:` frames of an SSE body as JSON objects, in order. Comment
 * lines (`: keepalive`), `event:` lines and malformed JSON are skipped.
 * *onEvent* returning `false` stops the read early.
 *
 * With *idleTimeoutMs* (or a function giving it, read each time it is armed;
 * `undefined` keeps it off), a body whose comment lines span a third of it at
 * least - a server keeping it alive, not an opening burst - and that then
 * sends nothing for that long is dead (a proxy left it half-open, the machine
 * slept): the read is cancelled and rejects with {@link SseStreamSilentError}.
 * Any other body is never timed out, since its server may stay silent through
 * a long step.
 */
export async function readSseEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (evt: Record<string, unknown>) => boolean | void,
  { idleTimeoutMs }: { idleTimeoutMs?: number | (() => number | undefined) } = {},
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // When the first comment came, and whether later ones showed a keep-alive cadence.
  let firstCommentAt: number | null = null;
  let keptAlive = false;
  let silent = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const rearm = () => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    const timeout = typeof idleTimeoutMs === 'function' ? idleTimeoutMs() : idleTimeoutMs;
    if (!keptAlive || timeout === undefined) return;
    watchdog = setTimeout(() => {
      silent = true;
      void reader.cancel().catch(() => undefined);
    }, timeout);
  };
  const handle = (rawLine: string): boolean => {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith(':')) {
      const now = Date.now();
      if (firstCommentAt === null) firstCommentAt = now;
      const timeout = typeof idleTimeoutMs === 'function' ? idleTimeoutMs() : idleTimeoutMs;
      if (timeout !== undefined && now - firstCommentAt >= timeout / 3) keptAlive = true;
    }
    if (!line.startsWith('data:')) return true;
    const json = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
    let evt: unknown;
    try {
      evt = JSON.parse(json);
    } catch {
      return true;
    }
    if (!evt || typeof evt !== 'object' || Array.isArray(evt)) return true;
    return onEvent(evt as Record<string, unknown>) !== false;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (silent) throw new SseStreamSilentError();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!handle(line)) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
      rearm();
    }
    buffer += decoder.decode();
    if (buffer) handle(buffer);
  } finally {
    if (watchdog !== null) clearTimeout(watchdog);
    reader.releaseLock();
  }
}
