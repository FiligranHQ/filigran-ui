/**
 * Unit tests for the conversation list's workspace groups - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ELSEWHERE_GROUP, fileableWorkspaces, groupConversations, groupIsOpen, parseWorkspaces, refusalMessage } from './workspaces.ts';
import type { ChatWorkspace } from '../types';

const ws = (id: string, name: string, over: Partial<ChatWorkspace> = {}): ChatWorkspace => ({
  id,
  name,
  isOwn: true,
  isDefault: false,
  canManage: true,
  ...over,
});
const conv = (conversationId: string, workspaceId: string | null = null) => ({ conversationId, title: conversationId, workspaceId });

test("a colleague's default is not sorted first", () => {
  const { groups } = groupConversations(
    [],
    [ws('w-r', 'Research'), ws('w-theirs', 'Aaa', { isOwn: false, isDefault: true }), ws('w-g', 'General', { isDefault: true })],
  );
  assert.deepEqual(
    groups.map((g) => g.key),
    ['w-g', 'w-theirs', 'w-r'],
  );
});

test('the workspace payload is read defensively, archived ones left out', () => {
  assert.deepEqual(
    parseWorkspaces({
      workspaces: [
        { id: 'w1', name: 'General', is_own: true, is_default: true, can_manage: true },
        { id: 'w2', name: 'Old', is_archived: true, can_manage: true },
        { name: 'no id' },
        'garbage',
      ],
    }),
    [{ id: 'w1', name: 'General', isOwn: true, isDefault: true, canManage: true }],
  );
  assert.deepEqual(parseWorkspaces(null), []);
  assert.equal(parseWorkspaces([{ id: 'w', name: 'Bare list' }]).length, 1);
});

test('every workspace the caller can file into has a group, their default first', () => {
  const { groups, unfiled } = groupConversations(
    [conv('c1', 'w-research'), conv('c2')],
    [ws('w-research', 'Research'), ws('w-acme', 'Acme'), ws('w-general', 'General', { isDefault: true })],
  );
  assert.deepEqual(
    groups.map((g) => [g.key, g.conversations.map((c) => c.conversationId)]),
    [
      ['w-general', []],
      ['w-acme', []],
      ['w-research', ['c1']],
    ],
  );
  assert.deepEqual(
    unfiled.map((c) => c.conversationId),
    ['c2'],
  );
});

test('read-only and unreachable workspaces', () => {
  const readOnly = ws('w-ro', 'Team', { isOwn: false, canManage: false });
  assert.deepEqual(groupConversations([conv('c1')], [readOnly]).groups, []);
  const { groups } = groupConversations([conv('c1', 'w-ro'), conv('c2', 'w-gone')], [readOnly]);
  assert.deepEqual(
    groups.map((g) => g.key),
    ['w-ro', ELSEWHERE_GROUP],
  );
});

test('a search hides the groups it empties and opens the rest', () => {
  const { groups } = groupConversations([conv('acme', 'w-a'), conv('lunch', 'w-b')], [ws('w-a', 'A'), ws('w-b', 'B')], {
    matches: (c) => c.conversationId.includes('acme'),
  });
  assert.deepEqual(
    groups.map((g) => g.key),
    ['w-a'],
  );
  const collapsed = new Set(['w-a']);
  assert.equal(groupIsOpen('w-a', collapsed, groups[0], null, false), false);
  assert.equal(groupIsOpen('w-a', collapsed, groups[0], 'acme', false), true);
  assert.equal(groupIsOpen('w-a', collapsed, groups[0], null, true), true);
});

test("a refusal says XTM One's own words", async () => {
  assert.equal(
    await refusalMessage(new Response(JSON.stringify({ detail: 'That workspace is archived.' }), { status: 400 })),
    'That workspace is archived.',
  );
  assert.equal(await refusalMessage(new Response('not json', { status: 502 })), null);
});

test('the move menu offers what the caller can file into, in the order the list shows', () => {
  assert.deepEqual(
    fileableWorkspaces([
      ws('w-b', 'Board reporting'),
      ws('w-ro', 'Aaa read-only', { canManage: false }),
      ws('w-t', 'Threat research'),
      ws('w-g', 'General', { isDefault: true }),
      ws('w-a', 'Acme audit'),
    ]).map((w) => w.name),
    ['General', 'Acme audit', 'Board reporting', 'Threat research'],
  );
});
