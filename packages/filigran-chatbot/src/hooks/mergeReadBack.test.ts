/**
 * Unit tests for a read-back that waited for a turn to end, merged into the
 * thread on screen, and for how a turn that ended out of sight ended by it -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage } from '../types.ts';
import { mergeReadBack, sentTextOf, unseenTurnOutcome, withSentText } from './useChat.ts';

const at = new Date(0);
const msg = (id: string, role: ChatMessage['role'], content: string, serverId?: string): ChatMessage => ({
  id,
  role,
  content,
  timestamp: at,
  ...(serverId ? { serverId } : {}),
});
const shown = (messages: ChatMessage[]) => messages.map((m) => m.serverId ?? m.content);

test('a stored message missing from the screen goes after the one stored before it, not above the thread', () => {
  // The segment closed while the event stream was closed, the turn's last one shown.
  const prev = [msg('b1', 'user', 'Question', 'u1'), msg('b2', 'assistant', 'Seg one', 'a1'), msg('b3', 'assistant', 'Seg three', 'a3')];
  const restored = [msg('r0', 'user', 'Question', 'u1'), msg('r1', 'assistant', 'Seg one', 'a1'), msg('r2', 'assistant', 'Seg two', 'a2')];
  assert.deepEqual(shown(mergeReadBack(prev, restored)), ['u1', 'a1', 'a2', 'a3']);
});

test('a first read-back goes above what was shown meanwhile, and the message sent then takes its stored id', () => {
  const prev = [msg('b1', 'user', 'Sent meanwhile'), msg('b2', 'assistant', 'Answer', 'a9')];
  const restored = [msg('r0', 'user', 'Older', 'u0'), msg('r1', 'assistant', 'Older answer', 'a0'), msg('r2', 'user', 'Sent meanwhile', 'u1')];
  const merged = mergeReadBack(prev, restored);
  assert.deepEqual(shown(merged), ['u0', 'a0', 'u1', 'a9']);
  assert.equal(merged[2].id, 'b1', 'the bubble on screen stays');
  assert.equal(new Set(merged.map((m) => m.id)).size, merged.length, 'every id once');
});

test('a bubble matched keeps the words it shows', () => {
  const prev = [msg('b1', 'user', 'Question', 'u1'), withSentText(msg('b2', 'user', 'Report attached'), 'Look at the full report')];
  const restored = [msg('r0', 'user', 'Question', 'u1'), msg('r1', 'user', 'Look at the full report', 'u2')];
  const merged = mergeReadBack(prev, restored);
  assert.deepEqual(
    merged.map((m) => [m.serverId, m.content]),
    [
      ['u1', 'Question'],
      ['u2', 'Report attached'],
    ],
  );
});

test('nothing missing and nothing to adopt leaves the thread as it is', () => {
  const prev = [msg('b1', 'user', 'Question', 'u1')];
  assert.equal(mergeReadBack(prev, [msg('r0', 'user', 'Question', 'u1')]), prev);
});

test('a turn that ended out of sight answered when the read-back holds an answer after what was shown, and stopped otherwise', () => {
  const question = msg('r0', 'user', 'Question', 'u1');
  const segment = msg('r1', 'assistant', 'Seg one', 'a1');
  const answer = msg('r2', 'assistant', 'Seg two', 'a2');
  assert.equal(unseenTurnOutcome([question, segment, answer], 'a1'), 'answered');
  assert.equal(unseenTurnOutcome([question, segment], 'a1'), 'stopped', 'nothing stored since');
  assert.equal(unseenTurnOutcome([question], 'u1'), 'stopped');
  assert.equal(unseenTurnOutcome([question, answer], null), 'answered', 'nothing stored was shown');
  assert.equal(unseenTurnOutcome([segment, answer], 'u0'), 'stopped', 'what was shown is no longer read');
});

test('the text a bubble was sent with goes with every copy of it, and is no field of the message', () => {
  const bubble = withSentText(msg('b1', 'user', 'one'), 'wrapped one');
  assert.equal(sentTextOf({ ...bubble, serverId: 'u1' }), 'wrapped one');
  assert.deepEqual(Object.keys(bubble), Object.keys(msg('b1', 'user', 'one')));
  assert.equal(sentTextOf(msg('b2', 'user', 'two')), 'two', 'a bubble showing the text sent');
  const plain = msg('b3', 'user', 'three');
  assert.equal(withSentText(plain, 'three'), plain);
});
