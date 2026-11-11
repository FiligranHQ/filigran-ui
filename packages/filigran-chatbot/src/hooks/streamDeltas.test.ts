/**
 * Unit tests for applying streamed deltas once per frame, the answer text
 * revealed at a steady pace - `yarn test`.
 *
 * Frames are driven by hand: `requestAnimationFrame` is replaced for each test
 * by a clock that only runs when told to.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createStreamDeltas, nextRevealLength, STREAM_CATCH_UP_MS, STREAM_MIN_CHARS_PER_FRAME } from './streamDeltas.ts';

function installFrames() {
  const pending = new Map<number, FrameRequestCallback>();
  let next = 0;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      next += 1;
      pending.set(next, callback);
      return next;
    },
    cancelAnimationFrame: (handle: number) => {
      pending.delete(handle);
    },
  });
  return {
    get pending() {
      return pending.size;
    },
    run() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
  Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
});

function record() {
  const applied: Array<[text: string | null, thinking: string]> = [];
  const deltas = createStreamDeltas((text, thinking) => applied.push([text, thinking]));
  return { applied, deltas };
}

test('the deltas of one frame are applied once, together, on that frame', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.thinking('Looking ');
  deltas.text('Hi');
  deltas.thinking('it up.');
  deltas.text('Hi!');
  assert.deepEqual(applied, []);
  assert.equal(frames.pending, 1);
  frames.run();
  assert.deepEqual(applied, [['Hi!', 'Looking it up.']]);
  assert.equal(frames.pending, 0);

  deltas.thinking('More.');
  frames.run();
  assert.deepEqual(applied, [
    ['Hi!', 'Looking it up.'],
    [null, 'More.'],
  ]);
});

test('a burst of text is revealed over several frames, never all at once, and catches up within the window', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  const burst = 'x'.repeat(2000);
  deltas.text(burst);
  frames.run();
  const first = applied[0][0]!;
  assert.ok(first.length < burst.length, 'the first frame shows part of the burst');
  assert.ok(first.length >= STREAM_MIN_CHARS_PER_FRAME);
  let count = 1;
  while (frames.pending > 0) {
    frames.run();
    count += 1;
    assert.ok(count < 200, 'the reveal ends');
  }
  const lengths = applied.map(([text]) => text!.length);
  for (let index = 1; index < lengths.length; index += 1) assert.ok(lengths[index] > lengths[index - 1], 'every frame moves the text forward');
  assert.equal(lengths[lengths.length - 1], burst.length);
  // A frame step is sized so the backlog drains in about the window: the first
  // half is gone within it, whatever the size of the burst.
  const frameMs = 1000 / 60;
  const halfFrames = lengths.findIndex((length) => length >= burst.length / 2) + 1;
  assert.ok(halfFrames * frameMs <= STREAM_CATCH_UP_MS, `half the burst in ${halfFrames} frames`);
});

test('the reveal step is proportional to the backlog with a floor, and never passes the text', () => {
  assert.equal(nextRevealLength(0, 0), 0);
  assert.equal(nextRevealLength(10, 10), 10);
  assert.equal(nextRevealLength(0, 2), 2);
  assert.equal(nextRevealLength(0, 10), STREAM_MIN_CHARS_PER_FRAME);
  assert.ok(nextRevealLength(0, 10_000) > 400);
});

test('text arriving while a reveal runs is revealed by the same loop, one frame at a time', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.text('a'.repeat(100));
  frames.run();
  deltas.text('a'.repeat(200));
  assert.equal(frames.pending, 1);
  frames.run();
  assert.ok(applied[1][0]!.length > applied[0][0]!.length);
});

test('a flush shows all the text that arrived at once, and the frame then applies nothing twice', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.text('x'.repeat(500));
  frames.run();
  deltas.flush();
  assert.equal(applied[applied.length - 1]![0], 'x'.repeat(500));
  assert.equal(frames.pending, 0);
  const count = applied.length;
  frames.run();
  deltas.flush();
  assert.equal(applied.length, count);
});

test('a reset starts the text over: what was shown of the old text is not kept', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.text('first answer');
  deltas.flush();
  deltas.reset();
  deltas.text('Second');
  frames.run();
  assert.equal(applied[applied.length - 1]![0], 'Seco');
});

test('closing drops what is pending and ignores every later delta', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.thinking('lost');
  deltas.text('lost');
  deltas.close();
  assert.equal(frames.pending, 0);
  deltas.text('late');
  deltas.thinking('late');
  deltas.flush();
  frames.run();
  assert.deepEqual(applied, []);
});

test('without animation frames each delta is applied as it arrives, whole', () => {
  const { applied, deltas } = record();
  deltas.text('all of it');
  deltas.thinking('now');
  assert.deepEqual(applied, [
    ['all of it', ''],
    [null, 'now'],
  ]);
});
