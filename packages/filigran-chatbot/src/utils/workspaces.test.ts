/**
 * Unit tests for the conversation list's workspace groups - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ELSEWHERE_GROUP,
  fileableWorkspaces,
  groupConversations,
  groupIsOpen,
  parseWorkspaces,
  refusalMessage,
  revertMove,
  unfiledEmptyNote,
} from './workspaces.ts';
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

test('a refused move puts back that conversation alone', () => {
  // `b` was moved by another request that succeeded while this one was in
  // flight: undoing this move must not undo that one.
  const now = [conv('a', 'w-2'), conv('b', 'w-3')];
  const reverted = revertMove(now, 'a', 'w-2', 'w-1');
  assert.deepEqual(
    reverted.map((c) => [c.conversationId, c.workspaceId]),
    [
      ['a', 'w-1'],
      ['b', 'w-3'],
    ],
  );
  assert.equal(reverted[1], now[1]);
});

test('a refused move leaves a conversation that has moved since where it is', () => {
  // A later move (or a refresh) placed it elsewhere: that placement stands.
  const now = [conv('a', 'w-3')];
  assert.equal(revertMove(now, 'a', 'w-2', 'w-1'), now);
  // A move out of every workspace is undone like any other.
  assert.equal(revertMove([conv('a', null)], 'a', null, 'w-1')[0].workspaceId, 'w-1');
  // Gone from the list meanwhile.
  const empty: ReturnType<typeof conv>[] = [];
  assert.equal(revertMove(empty, 'a', 'w-2', 'w-1'), empty);
});

test('an empty unfiled group says why, except while searching', () => {
  assert.equal(unfiledEmptyNote({ total: 0, unfiled: 0, loading: false, searching: false }), 'none');
  assert.equal(unfiledEmptyNote({ total: 3, unfiled: 0, loading: false, searching: false }), 'all-filed');
  assert.equal(unfiledEmptyNote({ total: 3, unfiled: 1, loading: false, searching: false }), null);
  assert.equal(unfiledEmptyNote({ total: 3, unfiled: 0, loading: true, searching: false }), null);
  // The group holds matches only: every conversation is not in a workspace,
  // the search just found none outside one.
  assert.equal(unfiledEmptyNote({ total: 3, unfiled: 0, loading: false, searching: true }), null);
  assert.equal(unfiledEmptyNote({ total: 0, unfiled: 0, loading: false, searching: true }), null);
});
