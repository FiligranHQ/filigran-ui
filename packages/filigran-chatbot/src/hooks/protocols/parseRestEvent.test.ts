/**
 * Unit tests for the REST protocol's session restore and `done` frame - `yarn test`.
 *
 * `id`, `created_at` and `feedback` on a restored entry, and `message_id` on
 * `done`, are a cross-repo contract: XTM One sends them and the OpenCTI /
 * OpenAEV proxies forward them unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePersistedFeedback, parseRestEvent, parseRestoredMessages } from './parseRestEvent.ts';

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

test('entries that are not a user or an assistant message are skipped', () => {
  const restored = parseRestoredMessages([{ role: 'system', content: 'x' }, null, 'x', { role: 'user', content: 'Hi' }]);
  assert.deepEqual(
    restored.map((m) => [m.id, m.role, m.content]),
    [['restored-3', 'user', 'Hi']],
  );
  assert.deepEqual(parseRestoredMessages(undefined), []);
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
  // the turn open for it, so a `noop` would stall until its timeout (#443 review).
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
