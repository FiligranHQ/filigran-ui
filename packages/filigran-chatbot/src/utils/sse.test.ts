/**
 * Unit tests for reading the frames of an SSE body - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readSseEvents } from './sse.ts';

function body(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function read(stream: ReadableStream<Uint8Array>, stopAt?: number) {
  const seen: Record<string, unknown>[] = [];
  await readSseEvents(stream, (evt) => {
    seen.push(evt);
    return stopAt === undefined || seen.length < stopAt;
  });
  return seen;
}

test('frames split across chunks are read whole, in order', async () => {
  const seen = await read(body('data: {"type":"str', 'eam","content":"a"}\n\ndata: {"type":"done"}\n\n'));
  assert.deepEqual(seen, [{ type: 'stream', content: 'a' }, { type: 'done' }]);
});

test('keep-alive comments, event lines and malformed frames are skipped', async () => {
  const seen = await read(body(': keepalive\n', 'event: message\n', 'data: {not json}\n', 'data: [1]\n', 'data:{"type":"done"}\r\n'));
  assert.deepEqual(seen, [{ type: 'done' }]);
});

test('a last frame without its newline is still read', async () => {
  assert.deepEqual(await read(body('data: {"type":"done"}')), [{ type: 'done' }]);
});

test('returning false stops the read and cancels the body', async () => {
  let cancelled = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"n":1}\ndata: {"n":2}\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  assert.deepEqual(await read(stream, 1), [{ n: 1 }]);
  assert.equal(cancelled, true);
});
