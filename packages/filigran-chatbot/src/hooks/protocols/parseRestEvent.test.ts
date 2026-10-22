/**
 * Unit tests for the REST protocol's session restore and `done` frame - `yarn test`.
 *
 * `id`, `created_at` and `feedback` on a restored entry, and `message_id` on
 * `done`, are a cross-repo contract: XTM One sends them and the OpenCTI /
 * OpenAEV proxies forward them unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseConversationRefs, parsePersistedFeedback, parseRestEvent, parseRestoredMessages } from './parseRestEvent.ts';

test('a restored entry keeps its persisted id, its time and its rating', () => {
  const [user, answer] = parseRestoredMessages([
    { id: 'm-1', role: 'user', content: 'Who is behind it?', created_at: '2026-09-29T08:15:00Z' },
    {
      id: 'm-2',
      role: 'assistant',
      content: 'APT28.',
      created_at: '2026-09-29T08:15:04Z',
      feedback: { rating: 'negative', comment: 'wrong actor' },
      tool_names: ['search'],
      is_truncated: true,
    },
  ]);
  assert.equal(user.id, 'restored-0');
  assert.equal(user.serverId, 'm-1');
  assert.equal(user.role, 'user');
  assert.equal(user.timestamp.toISOString(), '2026-09-29T08:15:00.000Z');
  assert.equal(user.feedback, undefined);

  assert.equal(answer.id, 'restored-1');
  assert.equal(answer.serverId, 'm-2');
  assert.equal(answer.content, 'APT28.');
  assert.equal(answer.timestamp.toISOString(), '2026-09-29T08:15:04.000Z');
  assert.deepEqual(answer.feedback, { rating: 'negative', comment: 'wrong actor' });
  assert.deepEqual(answer.toolNames, ['search']);
  assert.equal(answer.isTruncated, true);
});

test('a restore from a backend without ids or times still restores', () => {
  const before = Date.now();
  const [entry] = parseRestoredMessages([{ role: 'assistant', content: 'Hello', created_at: 'not a date' }]);
  assert.equal(entry.serverId, undefined);
  assert.equal(entry.feedback, undefined);
  // A Date still, for whoever reads it; but the footer is told not to show it.
  assert.ok(entry.timestamp.getTime() >= before);
  assert.equal(entry.timestampUnknown, true);
});

test('a restored answer of a multi-agent turn names its agent, and says when it is a note for one that failed', () => {
  const [user, reply, note, plain] = parseRestoredMessages([
    { role: 'user', content: '@Analyst @Hunter go', answered_by: { agent_id: 'x', agent_name: 'X' }, mention_failed: true },
    { role: 'assistant', content: 'On it.', answered_by: { agent_id: 'a2', agent_name: 'Analyst', agent_icon: '🛰️' } },
    { role: 'assistant', content: 'Hunter did not answer.', answered_by: { agent_id: 'a1', agent_name: 'Hunter' }, mention_failed: true },
    { role: 'assistant', content: 'Plain.' },
  ]);
  assert.equal(user.answeredBy, undefined, 'a user message names no answering agent');
  assert.equal(user.mentionFailed, undefined);
  assert.deepEqual(reply.answeredBy, { agentId: 'a2', agentName: 'Analyst', agentIcon: '🛰️' });
  assert.equal(reply.mentionFailed, undefined);
  assert.deepEqual(note.answeredBy, { agentId: 'a1', agentName: 'Hunter' });
  assert.equal(note.mentionFailed, true);
  assert.equal(plain.answeredBy, undefined);
  assert.equal(plain.mentionFailed, undefined);
  assert.equal(reply.agentName, 'Analyst', 'a restored answer is named after the agent that wrote it, as a live one is');
  assert.equal(note.agentName, 'Hunter');
  assert.equal(plain.agentName, undefined);
  assert.equal(user.agentName, undefined);
});

test('entries that are not a user or an assistant message are skipped', () => {
  const restored = parseRestoredMessages([{ role: 'system', content: 'x' }, null, 'x', { role: 'user', content: 'Hi' }]);
  assert.deepEqual(
    restored.map((m) => [m.id, m.role, m.content]),
    [['restored-3', 'user', 'Hi']],
  );
  assert.deepEqual(parseRestoredMessages(undefined), []);
});

test('a restored user message keeps the conversations it referenced', () => {
  const [question, answer] = parseRestoredMessages([
    {
      id: 'm-1',
      role: 'user',
      content: 'Compare with @q3-threat-report',
      conversation_refs: [{ conversation_id: 'c-7', title: 'Q3 threat report', key: 'q3-threat-report' }],
    },
    { id: 'm-2', role: 'assistant', content: 'Done.', conversation_refs: [{ conversation_id: 'c-7', title: 'x', key: 'x' }] },
  ]);
  assert.deepEqual(question.conversationRefs, [{ conversationId: 'c-7', title: 'Q3 threat report', key: 'q3-threat-report' }]);
  // Only a user message references anything.
  assert.equal(answer.conversationRefs, undefined);
});

test('referenced conversations are read defensively', () => {
  assert.deepEqual(
    parseConversationRefs([
      { conversation_id: 'c-1', title: ' Weekly sync ', key: 'weekly-sync' },
      { conversation_id: 'c-2' },
      { conversation_id: 'c-1', title: 'Duplicate', key: 'duplicate' },
      { title: 'No id', key: 'no-id' },
      null,
      'c-3',
    ]),
    [
      { conversationId: 'c-1', title: 'Weekly sync', key: 'weekly-sync' },
      { conversationId: 'c-2', title: '', key: '' },
    ],
  );
  assert.equal(parseConversationRefs([]), undefined);
  assert.equal(parseConversationRefs(undefined), undefined);
  assert.equal(parseConversationRefs({ conversation_id: 'c-1' }), undefined);
});

test('a stored rating is read only when it is one', () => {
  assert.deepEqual(parsePersistedFeedback({ rating: 'positive', comment: null }), { rating: 'positive', comment: null });
  assert.deepEqual(parsePersistedFeedback({ rating: 'negative', comment: 'wrong actor' }), { rating: 'negative', comment: 'wrong actor' });
  assert.deepEqual(parsePersistedFeedback({ rating: 'negative', comment: '  ' }), { rating: 'negative', comment: null });
  assert.deepEqual(parsePersistedFeedback({ rating: 'negative' }), { rating: 'negative', comment: null });
  assert.equal(parsePersistedFeedback({ rating: 'up' }), undefined);
  assert.equal(parsePersistedFeedback(null), undefined);
  assert.equal(parsePersistedFeedback('positive'), undefined);
});

test('the done frame carries the persisted id of the answer', () => {
  const ctx = { hasUsedTools: false, activeNodeId: '' };
  const done = parseRestEvent({ type: 'done', content: 'Hi', conversation_id: 'c-1', message_id: 'm-9' }, ctx);
  assert.equal(done.action, 'done');
  assert.equal(done.action === 'done' ? done.messageId : null, 'm-9');

  const older = parseRestEvent({ type: 'done', content: 'Hi', message_id: '' }, ctx);
  assert.equal(older.action === 'done' ? older.messageId : null, undefined);
});

test('a page action frame carries the action to perform and its id (#5559)', () => {
  const ctx = { hasUsedTools: true, activeNodeId: '' };
  const frame = (action: unknown, extra: Record<string, unknown> = {}) =>
    parseRestEvent(
      {
        type: 'status',
        status: 'tool_progress',
        tool: 'act_on_page',
        event: 'page_action_required',
        conversation_id: 'c-1',
        action_id: 'a-1',
        action,
        ...extra,
      },
      ctx,
    );
  assert.deepEqual(frame({ type: 'click', ref: 'e2' }), {
    action: 'page_action_required',
    actionId: 'a-1',
    pageAction: { type: 'click', ref: 'e2' },
    conversationId: 'c-1',
  });
  assert.deepEqual(frame({ type: 'type', ref: 'e3', text: 'apt28' }).action, 'page_action_required');
  assert.deepEqual(frame({ type: 'navigate', path: '/dashboard' }).action, 'page_action_required');
  assert.deepEqual(frame({ type: 'snapshot' }).action, 'page_action_required');
  assert.deepEqual(frame({ type: 'open', ref: 'e4' }).action, 'page_action_required');
  // Without an id there is nothing to answer against, so that frame is dropped.
  assert.deepEqual(frame({ type: 'click', ref: 'e2' }, { action_id: undefined }), { action: 'noop' });
  // An action this version does not know is still answered: the backend holds
  // the turn open for it, so a `noop` would stall until its timeout.
  assert.deepEqual(frame({ type: 'run_script', code: 'x' }), {
    action: 'page_action_required',
    actionId: 'a-1',
    pageAction: { type: 'unsupported', requested: 'run_script' },
    conversationId: 'c-1',
  });
  // Same for a known name whose arguments are missing.
  assert.deepEqual(frame({ type: 'click' }), {
    action: 'page_action_required',
    actionId: 'a-1',
    pageAction: { type: 'unsupported', requested: 'click' },
    conversationId: 'c-1',
  });
});
