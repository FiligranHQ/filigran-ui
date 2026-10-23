/**
 * Unit tests for a read-back that waited for a turn to end, merged into the
 * thread on screen - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage } from '../types.ts';
import { mergeReadBack } from './useChat.ts';

const at = new Date(0);
const msg = (id: string, role: ChatMessage['role'], content: string, serverId?: string): ChatMessage => ({
  id,
  role,
  content,
  timestamp: at,
  ...(serverId ? { serverId } : {}),
});
const shown = (messages: ChatMessage[]) => messages.map((m) => m.serverId ?? m.content);
const plain = (m: ChatMessage) => m.content;

test('a stored message missing from the screen goes after the one stored before it, not above the thread', () => {
  // The segment closed while the event stream was closed, the turn's last one shown.
  const prev = [msg('b1', 'user', 'Question', 'u1'), msg('b2', 'assistant', 'Seg one', 'a1'), msg('b3', 'assistant', 'Seg three', 'a3')];
  const restored = [msg('r0', 'user', 'Question', 'u1'), msg('r1', 'assistant', 'Seg one', 'a1'), msg('r2', 'assistant', 'Seg two', 'a2')];
  assert.deepEqual(shown(mergeReadBack(prev, restored, plain)), ['u1', 'a1', 'a2', 'a3']);
});

test('a first read-back goes above what was shown meanwhile, and the message sent then takes its stored id', () => {
  const prev = [msg('b1', 'user', 'Sent meanwhile'), msg('b2', 'assistant', 'Answer', 'a9')];
  const restored = [msg('r0', 'user', 'Older', 'u0'), msg('r1', 'assistant', 'Older answer', 'a0'), msg('r2', 'user', 'Sent meanwhile', 'u1')];
  const merged = mergeReadBack(prev, restored, plain);
  assert.deepEqual(shown(merged), ['u0', 'a0', 'u1', 'a9']);
  assert.equal(merged[2].id, 'b1', 'the bubble on screen stays');
  assert.equal(new Set(merged.map((m) => m.id)).size, merged.length, 'every id once');
});

test('a bubble matched keeps the words it shows', () => {
  const sentText = new Map([['b2', 'Look at the full report']]);
  const prev = [msg('b1', 'user', 'Question', 'u1'), msg('b2', 'user', 'Report attached')];
  const restored = [msg('r0', 'user', 'Question', 'u1'), msg('r1', 'user', 'Look at the full report', 'u2')];
  const merged = mergeReadBack(prev, restored, (m) => sentText.get(m.id) ?? m.content);
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
  assert.equal(mergeReadBack(prev, [msg('r0', 'user', 'Question', 'u1')], plain), prev);
});
