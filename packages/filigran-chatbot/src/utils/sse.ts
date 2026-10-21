/**
 * Read the `data:` frames of an SSE body as JSON objects, in order. Comment
 * lines (`: keepalive`), `event:` lines and malformed JSON are skipped.
 * *onEvent* returning `false` stops the read early.
 */
export async function readSseEvents(body: ReadableStream<Uint8Array>, onEvent: (evt: Record<string, unknown>) => boolean | void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = (rawLine: string): boolean => {
    const line = rawLine.replace(/\r$/, '');
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
    }
    buffer += decoder.decode();
    if (buffer) handle(buffer);
  } finally {
    reader.releaseLock();
  }
}
