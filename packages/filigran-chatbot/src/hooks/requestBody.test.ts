/**
 * Unit tests for the message body and the host's extra fields - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestBody } from './useChat.ts';
import { findAgent } from './useAgents.ts';

const base = { legacyChatId: null, conversationId: 'c1', agentSlug: 'hunter' };

test("the host's extras ride along but never override the panel's own fields", () => {
  const body = buildRequestBody('rest', 'hello', {
    ...base,
    extras: { desktop_runner_id: 'r1', content: 'injected', conversation_id: 'other', mode: 'deep_investigation' },
  });
  assert.equal(body.content, 'hello');
  assert.equal(body.conversation_id, 'c1');
  assert.equal(body.desktop_runner_id, 'r1');
  assert.equal(body.mode, 'deep_investigation');
});

test('without extras the body is unchanged', () => {
  assert.deepEqual(buildRequestBody('rest', 'hello', base), {
    content: 'hello',
    conversation_id: 'c1',
    agent_slug: 'hunter',
    supports_artifacts: true,
  });
});

test('extras are a REST matter only', () => {
  assert.deepEqual(buildRequestBody('legacy', 'hello', { ...base, extras: { x: 1 } }), { question: 'hello', chatId: undefined, streaming: true });
});

test('an agent is found by id first, then by slug', () => {
  const agents = [
    { id: 'a1', name: 'One', slug: 'a2', icon: null, description: null },
    { id: 'a2', name: 'Two', slug: 'two', icon: null, description: null },
  ];
  assert.equal(findAgent(agents, 'a2')?.name, 'Two');
  assert.equal(findAgent(agents, 'two')?.name, 'Two');
  assert.equal(findAgent(agents, 'nope'), undefined);
  assert.equal(findAgent(agents, undefined), undefined);
});
