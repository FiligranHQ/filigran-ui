/**
 * Unit tests for what `onStreamEvent` is told of a frame - `yarn test`: the
 * end of a turn (provisional or stored) and a replay, as the panel reads them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRestEvent } from './protocols/parseRestEvent.ts';
import { streamEventInfo } from './useChat.ts';

const info = (frame: Record<string, unknown>, relayed = false) =>
  streamEventInfo(relayed, parseRestEvent(frame, { hasUsedTools: false, activeNodeId: '' }));

test('an error or cancelled with neither message_id nor reason ends a turn provisionally', () => {
  assert.deepEqual(info({ type: 'cancelled' }), { relayed: false, end: 'provisional' });
  assert.deepEqual(info({ type: 'error', content: 'Boom' }, true), { relayed: true, end: 'provisional' });
});

test('an end naming the stored answer is the stored end; an intermediate done is no end', () => {
  assert.deepEqual(info({ type: 'done', content: 'x', message_id: 'm1' }), { relayed: false, end: 'stored' });
  assert.deepEqual(info({ type: 'cancelled', message_id: 'm2' }), { relayed: false, end: 'stored' });
  assert.deepEqual(info({ type: 'error', content: 'Boom', message_id: 'm3' }), { relayed: false, end: 'stored' });
  assert.deepEqual(info({ type: 'done', content: 'x', message_id: 'm4', intermediate: true }), { relayed: false });
  assert.deepEqual(info({ type: 'done', content: 'x' }), { relayed: false }, 'a done storing nothing names no stored end');
  assert.deepEqual(info({ type: 'error', content: 'Lost', reason: 'lost' }), { relayed: false }, 'an end with a reason is final, not stored');
});

test('a resumed acknowledgement is a replay; other frames say nothing more', () => {
  assert.deepEqual(info({ type: 'thinking', resumed: true, elapsed_s: 4 }, true), { relayed: true, replayed: true });
  assert.deepEqual(info({ type: 'thinking' }), { relayed: false });
  assert.deepEqual(info({ type: 'stream', content: 'x' }), { relayed: false });
  assert.deepEqual(streamEventInfo(true, undefined), { relayed: true }, 'a frame that could not be read');
});
