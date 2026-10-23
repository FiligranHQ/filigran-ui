/**
 * Unit tests for the frames of a backend whose turns outlive their stream
 * (XTM One's native chat): resume, wait, cancel and conversation events -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRestEvent } from './parseRestEvent.ts';

const ctx = () => ({ hasUsedTools: false, activeNodeId: '' });

test('a resumed turn says how long it has run', () => {
  assert.deepEqual(parseRestEvent({ type: 'thinking', resumed: true, elapsed_s: 42 }, ctx()), {
    action: 'status',
    status: 'thinking',
    resumed: true,
    elapsedS: 42,
  });
});

test('an announced wait carries its length and reason', () => {
  assert.deepEqual(parseRestEvent({ type: 'status', status: 'wait_start', seconds: 30, reason: 'Rate limited' }, ctx()), {
    action: 'status',
    status: 'wait_start',
    waitSeconds: 30,
    waitReason: 'Rate limited',
  });
});

test('cancelled, approval_resolved and folded turns are their own actions', () => {
  assert.deepEqual(parseRestEvent({ type: 'cancelled', message_id: 'm1' }, ctx()), {
    action: 'cancelled',
    messageId: 'm1',
    raw: { type: 'cancelled', message_id: 'm1' },
  });
  assert.deepEqual(parseRestEvent({ type: 'approval_resolved' }, ctx()), { action: 'approval_resolved' });
  assert.deepEqual(parseRestEvent({ type: 'folded_into_active_turn', turn_id: 't1' }, ctx()), { action: 'folded', turnId: 't1' });
});

test('an end with neither message_id nor reason is provisional: the stored end follows it', () => {
  assert.deepEqual(parseRestEvent({ type: 'cancelled' }, ctx()), { action: 'cancelled', provisional: true });
  assert.deepEqual(parseRestEvent({ type: 'error', content: 'Boom' }, ctx()), { action: 'error', content: 'Boom', provisional: true });
  assert.deepEqual(parseRestEvent({ type: 'error', content: 'Lost', reason: 'lost' }, ctx()), { action: 'error', content: 'Lost' });
  assert.deepEqual(parseRestEvent({ type: 'cancelled', message_id: 'm2' }, ctx()), {
    action: 'cancelled',
    messageId: 'm2',
    raw: { type: 'cancelled', message_id: 'm2' },
  });
});

test('a new title needs a title', () => {
  assert.deepEqual(parseRestEvent({ type: 'conversation_title', conversation_id: 'c1', title: 'Hunting APT28' }, ctx()), {
    action: 'conversation_title',
    conversationId: 'c1',
    title: 'Hunting APT28',
  });
  assert.deepEqual(parseRestEvent({ type: 'conversation_title', title: '' }, ctx()), { action: 'noop' });
});

test('a user message from another device is restored like a history entry', () => {
  const parsed = parseRestEvent(
    { type: 'user_message', message: { id: 'm1', role: 'user', content: 'hello', created_at: '2026-10-20T10:00:00Z' } },
    ctx(),
  );
  assert.equal(parsed.action, 'user_message');
  if (parsed.action !== 'user_message') return;
  assert.equal(parsed.message.serverId, 'm1');
  assert.equal(parsed.message.id, 'msg-m1');
  assert.equal(parsed.message.content, 'hello');
  assert.equal(parseRestEvent({ type: 'user_message', message: { role: 'assistant', content: 'x' } }, ctx()).action, 'noop');
});

test('done says whether the turn goes on, and who answered', () => {
  const parsed = parseRestEvent({ type: 'done', content: 'x', intermediate: true, answered_by: { agent_id: 'a', agent_name: 'Hunter' } }, ctx());
  assert.equal(parsed.action, 'done');
  if (parsed.action !== 'done') return;
  assert.equal(parsed.intermediate, true);
  assert.deepEqual(parsed.answeredBy, { agentId: 'a', agentName: 'Hunter' });
  assert.equal(parsed.mentionFailed, undefined);
  const plain = parseRestEvent({ type: 'done', content: 'x', answered_by: 'Analyst' }, ctx());
  assert.deepEqual(plain.action === 'done' && plain.answeredBy, { agentName: 'Analyst' });
  assert.equal(plain.action === 'done' && plain.intermediate, undefined);
  const failed = parseRestEvent(
    { type: 'done', content: 'n', mention_failed: true, answered_by: { agent_id: 'b', agent_name: 'Analyst', agent_icon: '🛰️', extra: 1 } },
    ctx(),
  );
  assert.deepEqual(failed.action === 'done' && failed.answeredBy, { agentId: 'b', agentName: 'Analyst', agentIcon: '🛰️' });
  assert.equal(failed.action === 'done' && failed.mentionFailed, true);
  const nobody = parseRestEvent({ type: 'done', content: 'x', answered_by: { agent_icon: '🛰️' } }, ctx());
  assert.equal(nobody.action === 'done' && nobody.answeredBy, undefined, 'an attribution naming no agent is none');
});

test('a session_expired frame ends the turn, with its reason', () => {
  assert.deepEqual(parseRestEvent({ type: 'session_expired', reason: 'idle' }, ctx()), { action: 'session_ended', reason: 'idle' });
  assert.deepEqual(parseRestEvent({ type: 'session_expired' }, ctx()), { action: 'session_ended', reason: undefined });
});

test('a done frame, and a stored end, carry a copy of the frame for the host', () => {
  const frame = { type: 'done', content: 'x', message_id: 'm1', llm_trace_id: 'tr-1', channel: { kind: 'teams' } };
  const done = parseRestEvent(frame, ctx());
  assert.deepEqual(done.action === 'done' && done.raw, frame);
  assert.notEqual(done.action === 'done' && done.raw, frame, 'a copy, not the frame itself');
  const stored = parseRestEvent({ type: 'error', content: 'Boom', message_id: 'm2', llm_trace_id: 'tr-2' }, ctx());
  assert.deepEqual(stored.action === 'error' && stored.raw, { type: 'error', content: 'Boom', message_id: 'm2', llm_trace_id: 'tr-2' });
});
