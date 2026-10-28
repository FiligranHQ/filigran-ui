/**
 * Unit tests for reading the frames of an SSE body - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readSseEvents, SseStreamSilentError } from './sse.ts';

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

/** A body that sends *chunks* one by one, *gapMs* apart, and stays open. */
function paced(gapMs: number, ...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, gapMs));
        controller.enqueue(encoder.encode(chunk));
      }
    },
  });
}

test('a body its server keeps alive that falls silent is given up as dead', async () => {
  const seen: Record<string, unknown>[] = [];
  await assert.rejects(
    readSseEvents(paced(15, ': keepalive\n\n', ': keepalive\n\n', 'data: {"n":1}\n\n'), (evt) => void seen.push(evt), {
      idleTimeoutMs: 30,
    }),
    SseStreamSilentError,
  );
  assert.deepEqual(seen, [{ n: 1 }]);
});

test('a body that never sent a keep-alive is not timed out, however long it stays silent', async () => {
  const seen: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode('data: {"n":1}\n\n'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      controller.enqueue(encoder.encode('data: {"n":2}\n\n'));
      controller.close();
    },
  });
  await readSseEvents(stream, (evt) => void seen.push(evt), { idleTimeoutMs: 30 });
  assert.deepEqual(seen, [{ n: 1 }, { n: 2 }]);
});

test('an opening burst of comments does not arm the timeout: it is no keep-alive cadence', async () => {
  const seen: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n: ok\n\n'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      controller.enqueue(encoder.encode('data: {"n":1}\n\n'));
      controller.close();
    },
  });
  await readSseEvents(stream, (evt) => void seen.push(evt), { idleTimeoutMs: 30 });
  assert.deepEqual(seen, [{ n: 1 }]);
});

test('a timeout given by a function that answers nothing stays off', async () => {
  const seen: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of [': keepalive\n\n', ': keepalive\n\n']) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        controller.enqueue(encoder.encode(chunk));
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
      controller.enqueue(encoder.encode('data: {"n":1}\n\n'));
      controller.close();
    },
  });
  await readSseEvents(stream, (evt) => void seen.push(evt), { idleTimeoutMs: () => undefined });
  assert.deepEqual(seen, [{ n: 1 }]);
});

test('keep-alives within the timeout keep the body read', async () => {
  const seen: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of [': keepalive\n\n', ': keepalive\n\n', ': keepalive\n\n', 'data: {"n":1}\n\n']) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  await readSseEvents(stream, (evt) => void seen.push(evt), { idleTimeoutMs: 60 });
  assert.deepEqual(seen, [{ n: 1 }]);
});
