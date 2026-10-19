/**
 * Unit tests for the polling a card follows a rendering video with - `yarn test`.
 */
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { pollInTurn } from './polling.ts';

const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
afterEach(() => mock.timers.reset());

test('a call waits for the last one to answer, however slow it is', async () => {
  const answers: Array<() => void> = [];
  const stop = pollInTurn(() => new Promise<void>((resolve) => answers.push(resolve)), { intervalMs: 10, forMs: 1000 });

  mock.timers.tick(10);
  assert.equal(answers.length, 1);
  mock.timers.tick(50);
  assert.equal(answers.length, 1, 'no second call while the first is unanswered');

  answers[0]();
  await settle();
  mock.timers.tick(9);
  assert.equal(answers.length, 1);
  mock.timers.tick(1);
  assert.equal(answers.length, 2);

  stop();
  answers[1]();
  await settle();
  mock.timers.tick(100);
  assert.equal(answers.length, 2, 'nothing is called once stopped');
});

test('a failed call is followed by the next, and polling gives up after its window', async () => {
  let calls = 0;
  let gaveUp = false;
  pollInTurn(
    () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve();
    },
    { intervalMs: 10, forMs: 35, onGiveUp: () => (gaveUp = true) },
  );

  for (let i = 0; i < 3; i++) {
    mock.timers.tick(10);
    await settle();
  }
  assert.equal(calls, 3);
  assert.equal(gaveUp, false);

  mock.timers.tick(10);
  assert.equal(gaveUp, true);
  mock.timers.tick(100);
  await settle();
  assert.equal(calls, 3);
});
