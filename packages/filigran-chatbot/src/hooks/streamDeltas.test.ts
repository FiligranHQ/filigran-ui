/**
 * Unit tests for applying streamed deltas once per frame - `yarn test`.
 *
 * Frames are driven by hand: `requestAnimationFrame` is replaced for each test
 * by a clock that only runs when told to.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createStreamDeltas } from './streamDeltas.ts';

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
  const applied: Array<[textChanged: boolean, thinking: string]> = [];
  const deltas = createStreamDeltas((textChanged, thinking) => applied.push([textChanged, thinking]));
  return { applied, deltas };
}

test('the deltas of one frame are applied once, together, on that frame', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.thinking('Looking ');
  deltas.text();
  deltas.thinking('it up.');
  deltas.text();
  assert.deepEqual(applied, []);
  assert.equal(frames.pending, 1);
  frames.run();
  assert.deepEqual(applied, [[true, 'Looking it up.']]);

  deltas.thinking('More.');
  frames.run();
  assert.deepEqual(applied, [
    [true, 'Looking it up.'],
    [false, 'More.'],
  ]);
});

test('a flush applies what is pending at once, and the frame then applies nothing twice', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.text();
  deltas.flush();
  assert.deepEqual(applied, [[true, '']]);
  assert.equal(frames.pending, 0);
  frames.run();
  deltas.flush();
  assert.deepEqual(applied, [[true, '']]);
});

test('closing drops what is pending and ignores every later delta', () => {
  const frames = installFrames();
  const { applied, deltas } = record();
  deltas.thinking('lost');
  deltas.text();
  deltas.close();
  assert.equal(frames.pending, 0);
  deltas.text();
  deltas.thinking('late');
  deltas.flush();
  frames.run();
  assert.deepEqual(applied, []);
});

test('without animation frames each delta is applied as it arrives', () => {
  const { applied, deltas } = record();
  deltas.text();
  deltas.thinking('now');
  assert.deepEqual(applied, [
    [true, ''],
    [false, 'now'],
  ]);
});
