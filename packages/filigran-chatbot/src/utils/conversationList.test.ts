/**
 * Unit tests of the conversation list's rows - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { channelName, conversationMatches, revertRename, touchConversation } from './conversationList.ts';

const row = (id: string, extra: Record<string, unknown> = {}) => ({ conversationId: id, title: id.toUpperCase(), ...extra });

test('a search matches the title, the last message and the agent', () => {
  const c = row('c1', { title: 'Hunting', lastMessagePreview: 'Found APT28 beacons', agentName: 'Threat Hunter' });
  assert.ok(conversationMatches(c, 'hunting'));
  assert.ok(conversationMatches(c, 'apt28'));
  assert.ok(conversationMatches(c, 'threat'));
  assert.ok(!conversationMatches(c, 'phishing'));
  assert.ok(!conversationMatches(row('c2', { title: '' }), 'x'), 'a row without the fields matches nothing');
});

test('a conversation written in goes first, with the time and the text sent', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const list = [row('c1', { updatedAt: '2026-11-02T09:00:00Z' }), row('c2', { updatedAt: '2026-10-01T00:00:00Z', lastMessagePreview: 'old' })];
  const touched = touchConversation(list, 'c2', '  new question ', now);
  assert.deepEqual(
    touched.map((c) => c.conversationId),
    ['c2', 'c1'],
  );
  assert.equal(touched[0].updatedAt, now.toISOString());
  assert.equal(touched[0].lastMessagePreview, 'new question');
  assert.equal(touchConversation(list, 'c9', 'x', now), list, 'a conversation the list does not hold leaves it as it is');
  assert.equal(touchConversation(list, 'c2', '  ', now)[0].lastMessagePreview, 'old', 'no text keeps the last preview');
});

test('a refused rename gives the row its title back, unless it changed since', () => {
  const list = [row('c1', { title: 'New' }), row('c2', { title: 'New' })];
  assert.deepEqual(
    revertRename(list, 'c1', 'New', 'Old').map((c) => c.title),
    ['Old', 'New'],
  );
  assert.equal(revertRename([row('c1', { title: 'Read back' })], 'c1', 'New', 'Old')[0].title, 'Read back');
});

test("a row names a messaging channel, the host's name over the panel's", () => {
  assert.equal(channelName('slack'), 'Slack');
  assert.equal(channelName('teams'), 'Teams');
  assert.equal(channelName('web'), null, "the panel's own channel is not named");
  assert.equal(channelName('api'), null);
  assert.equal(channelName(undefined), null);
  assert.equal(
    channelName('web', (c) => (c === 'web' ? 'Web chat' : undefined)),
    'Web chat',
  );
  assert.equal(
    channelName('slack', () => null),
    null,
  );
  assert.equal(
    channelName('slack', () => undefined),
    'Slack',
  );
  const original = console.error;
  console.error = () => undefined;
  try {
    assert.equal(
      channelName('slack', () => {
        throw new Error('boom');
      }),
      'Slack',
      'a host label that throws keeps the panel name',
    );
  } finally {
    console.error = original;
  }
});
