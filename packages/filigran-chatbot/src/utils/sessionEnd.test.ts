/**
 * Unit tests for how the panel tells that the user's session ended - `yarn test`.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { refusalSessionEnd, watchSessionEnd } from './sessionEnd.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const answer = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a refusal body says the session ended by its detail's code, with its reason", () => {
  assert.deepEqual(refusalSessionEnd({ detail: { code: 'session_expired', reason: 'idle' } }), { reason: 'idle' });
  assert.deepEqual(refusalSessionEnd({ detail: { code: 'session_expired' } }), { reason: undefined });
  assert.equal(refusalSessionEnd({ detail: { code: 'invalid_token' } }), null);
  assert.equal(refusalSessionEnd({ detail: 'session_expired' }), null);
  assert.equal(refusalSessionEnd(null), null);
});

test('a 401 saying the session ended is reported, and its body is still the caller’s to read', async () => {
  const heard: (string | undefined)[] = [];
  const watched = watchSessionEnd(() => (reason) => heard.push(reason));
  answer(401, { detail: { code: 'session_expired', reason: 'lifetime' } });
  const res = await watched('/api/chat/agents');
  assert.deepEqual(await res.json(), { detail: { code: 'session_expired', reason: 'lifetime' } });
  await settle();
  assert.deepEqual(heard, ['lifetime']);
});

test('any other answer is passed on untouched, and nothing is read without a reporter', async () => {
  const heard: unknown[] = [];
  const watched = watchSessionEnd(() => (reason) => heard.push(reason));
  answer(401, { detail: 'Not authenticated' });
  await watched('/x');
  answer(403, { detail: { code: 'session_expired' } });
  await watched('/x');
  answer(200, { detail: { code: 'session_expired' } });
  await watched('/x');
  await settle();
  assert.deepEqual(heard, [], 'only a 401 that says so');

  let asked = 0;
  const unwatched = watchSessionEnd(() => {
    asked += 1;
    return undefined;
  });
  answer(401, { detail: { code: 'session_expired' } });
  const res = await unwatched('/x');
  assert.equal(res.bodyUsed, false);
  assert.equal(asked, 1);
});
