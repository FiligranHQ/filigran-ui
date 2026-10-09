/**
 * Unit tests for the session request of the chat on screen - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSessionGate } from './sessionGate.ts';

/** A request the test answers by hand. */
function deferred() {
  let resolve!: (value: string | null) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let the settle handlers run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('callers of the same chat share one request', async () => {
  const gate = createSessionGate();
  const answer = deferred();
  let started = 0;
  const request = () => {
    started += 1;
    return answer.promise;
  };
  const first = gate.run(request);
  const second = gate.run(request);
  assert.equal(first, second);
  assert.equal(started, 1);
  answer.resolve('conv-1');
  assert.equal(await first, 'conv-1');
  await settle();
  assert.equal(gate.pending, null);
});

test('a request answered after a new chat is told it is stale', async () => {
  const gate = createSessionGate();
  const answer = deferred();
  let adopted: string | null = null;
  const stale = gate.run(async (isCurrent) => {
    const id = await answer.promise;
    if (!isCurrent()) return null;
    adopted = id;
    return id;
  });
  gate.abandon();
  answer.resolve('conv-old');
  assert.equal(await stale, null);
  assert.equal(adopted, null);
});

test("an abandoned request settling never releases the new chat's request", async () => {
  const gate = createSessionGate();
  const oldAnswer = deferred();
  const oldRequest = gate.run(() => oldAnswer.promise);
  gate.abandon();
  const newAnswer = deferred();
  const newRequest = gate.run(() => newAnswer.promise);
  assert.notEqual(newRequest, oldRequest);

  oldAnswer.resolve('conv-old');
  await oldRequest;
  await settle();
  // Still the new chat's: a third caller joins it instead of starting another.
  assert.equal(gate.pending, newRequest);
  assert.equal(
    gate.run(() => Promise.resolve('conv-other')),
    newRequest,
  );

  newAnswer.resolve('conv-new');
  assert.equal(await newRequest, 'conv-new');
  await settle();
  assert.equal(gate.pending, null);
});

test('a new chat changes the generation a caller compares', () => {
  const gate = createSessionGate();
  const before = gate.generation;
  gate.abandon();
  assert.notEqual(gate.generation, before);
});

test('a failed request resolves to null and frees the gate', async () => {
  const gate = createSessionGate();
  const answer = deferred();
  const request = gate.run(() => answer.promise);
  answer.reject(new Error('network'));
  assert.equal(await request, null);
  await settle();
  assert.equal(gate.pending, null);
});
