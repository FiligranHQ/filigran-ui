/**
 * Unit tests of the conversation list's date groups - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dateGroupKey, groupByDate, rowTitle, showsSeveralAgents } from './dateGroups.ts';

const t = (key: string) => key;
const now = new Date(2026, 10, 11, 10, 0, 0);
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();

test('a timestamp falls in today, yesterday, the last 7 or 30 days, or its month', () => {
  assert.equal(dateGroupKey(at(2026, 10, 11, 1), now), 'today');
  assert.equal(dateGroupKey(at(2026, 10, 10, 23), now), 'yesterday');
  assert.equal(dateGroupKey(at(2026, 10, 4), now), 'week');
  assert.equal(dateGroupKey(at(2026, 10, 3), now), 'month');
  assert.equal(dateGroupKey(at(2026, 9, 12), now), 'month');
  assert.equal(dateGroupKey(at(2026, 9, 11), now), '2026-10');
  assert.equal(dateGroupKey(at(2025, 0, 2), now), '2025-01');
  assert.equal(dateGroupKey(undefined, now), 'undated');
  assert.equal(dateGroupKey('not a date', now), 'undated');
});

test('the list is cut into groups in its own order, each holding at least one row', () => {
  const rows = [
    { id: 'a', updatedAt: at(2026, 10, 11) },
    { id: 'b', updatedAt: at(2026, 10, 11, 2) },
    { id: 'c', updatedAt: at(2026, 10, 10) },
    { id: 'd', updatedAt: at(2026, 7, 1) },
    { id: 'e' },
  ];
  const groups = groupByDate(rows, now, t);
  assert.deepEqual(
    groups.map((g) => [g.key, g.conversations.map((c) => c.id)]),
    [
      ['today', ['a', 'b']],
      ['yesterday', ['c']],
      ['2026-08', ['d']],
      ['undated', ['e']],
    ],
  );
  assert.equal(groups[0].label, 'Today');
  assert.equal(groups[1].label, 'Yesterday');
  assert.equal(groups[3].label, 'Older');
  assert.ok(groups[2].label.length > 0 && groups[2].label[0] === groups[2].label[0].toLocaleUpperCase(), 'a month in sentence case');
});

test('pinned conversations come first under Pinned, out of their date group', () => {
  const rows = [
    { id: 'a', updatedAt: at(2026, 10, 11) },
    { id: 'b', updatedAt: at(2026, 10, 10), pinned: true },
    { id: 'c', updatedAt: at(2026, 7, 1), pinned: true },
  ];
  const groups = groupByDate(rows, now, t, (c) => c.pinned === true);
  assert.deepEqual(
    groups.map((g) => [g.key, g.conversations.map((c) => c.id)]),
    [
      ['pinned', ['b', 'c']],
      ['today', ['a']],
    ],
  );
  assert.equal(groups[0].label, 'Pinned');
  assert.deepEqual(
    groupByDate(rows, now, t, () => false).map((g) => g.key),
    ['today', 'yesterday', '2026-08'],
    'nothing pinned: no Pinned group',
  );
});

test('rows show their agent only when the list mixes agents', () => {
  assert.equal(showsSeveralAgents([{ agentName: 'Hunter' }, { agentName: 'Hunter' }, {}]), false);
  assert.equal(showsSeveralAgents([{ agentName: 'Hunter' }, { agentName: 'Scout' }]), true);
});

test('a row without a title shows the first words of its conversation', () => {
  assert.equal(rowTitle({ title: ' Hunt ' }), 'Hunt');
  assert.equal(rowTitle({ title: '', lastMessagePreview: 'one two three four five six seven eight nine ten' }), 'one two three four five six seven eight');
  assert.equal(rowTitle({}), '');
});
