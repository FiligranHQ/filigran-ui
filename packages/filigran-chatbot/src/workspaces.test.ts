/**
 * Unit tests for the `@filigran/chatbot/workspaces` entry point - `yarn test`:
 * what it exports, that a host's own shapes group as the panel's do, and that
 * it stays free of React and of side effects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as workspaces from './workspaces.ts';
import type { WorkspaceGroup } from './workspaces.ts';

test('the entry point exports the grouping helpers, and nothing else', () => {
  assert.deepEqual(Object.keys(workspaces).sort(), [
    'ELSEWHERE_GROUP',
    'fileableWorkspaces',
    'groupCanToggle',
    'groupConversations',
    'groupIsOpen',
    'parseWorkspaces',
    'sortWorkspaces',
  ]);
});

test('a host feeding its backend list and its own conversations groups them as the panel does', () => {
  // As XTM One's own sidebar holds them: `user_id`, no `is_own`; archived ones listed.
  const list = [
    { id: 'w-theirs', name: 'Aaa', user_id: 'u2', is_default: true, is_archived: false, can_manage: false },
    { id: 'w-mine', name: 'General', user_id: 'u1', is_default: true, is_archived: false, can_manage: true },
    { id: 'w-old', name: 'Old', user_id: 'u1', is_default: false, is_archived: true, can_manage: true },
    { id: 'w-r', name: 'Research', user_id: 'u1', is_default: false, is_archived: false, can_manage: true },
  ];
  const parsed = workspaces.parseWorkspaces(list, { userId: 'u1' });
  assert.deepEqual(
    parsed.map((w) => [w.id, w.isOwn]),
    [
      ['w-theirs', false],
      ['w-mine', true],
      ['w-r', true],
    ],
    'archived ones left out, the own ones told by user_id',
  );
  assert.deepEqual(
    workspaces.parseWorkspaces([{ id: 'w', name: 'W', user_id: 'u1', is_own: false }], { userId: 'u1' }).map((w) => w.isOwn),
    [false],
    'is_own, when sent, decides',
  );

  const conversations = [
    { id: 'c1', title: 'One', workspace_id: 'w-theirs' },
    { id: 'c2', title: 'Two', workspace_id: null },
    { id: 'c3', title: 'Three', workspace_id: 'w-old' },
  ].map((c) => ({ ...c, conversationId: c.id, workspaceId: c.workspace_id }));
  const { groups, unfiled } = workspaces.groupConversations(conversations, parsed);
  const typed: WorkspaceGroup<(typeof conversations)[number]>[] = groups;
  assert.deepEqual(
    typed.map((g) => [g.key, g.conversations.map((c) => c.title)]),
    [
      ['w-mine', []],
      ['w-theirs', ['One']],
      ['w-r', []],
      [workspaces.ELSEWHERE_GROUP, ['Three']],
    ],
  );
  assert.deepEqual(
    unfiled.map((c) => c.title),
    ['Two'],
  );
  assert.deepEqual(
    workspaces.fileableWorkspaces(parsed).map((w) => w.id),
    ['w-mine', 'w-r'],
  );
  assert.equal(workspaces.groupIsOpen('w-theirs', new Set(['w-theirs']), groups[1], 'c1', false), true, 'held open by the conversation on screen');
});

test('the entry point pulls in no React, no stylesheet and nothing with side effects', () => {
  for (const file of ['./workspaces.ts', './utils/workspaces.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)].map((m) => ({ statement: m[0], from: m[1] }));
    assert.ok(imports.length > 0, `${file}: its imports were read`);
    for (const { statement, from } of imports) {
      assert.ok(!/react|\.css$/.test(from), `${file} imports ${from}`);
      if (file === './utils/workspaces.ts') assert.match(statement, /^import type /, `${file}: ${statement}`);
    }
    assert.ok(!/^import\s+'/m.test(source), `${file} has a side-effect import`);
  }
});
