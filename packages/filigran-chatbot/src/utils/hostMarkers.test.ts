/**
 * Unit tests for the host's own answer markers, agent icons and agent groups -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agentIconKind, groupAgents, markerKinds, splitAnswerMarkers, stripAnswerMarkers } from './index.ts';

test('marker names are upper-cased, deduplicated, and only valid ones kept', () => {
  assert.deepEqual(markerKinds(['work_item', 'WORK_ITEM', 'Investigation', 'bad-name', '1X']), ['INVESTIGATION', 'WORK_ITEM']);
  assert.deepEqual(markerKinds(undefined), []);
});

test('a host marker is its own part, in place, with its arguments as written', () => {
  assert.deepEqual(splitAnswerMarkers('Scheduled. [[WORK_ITEM:AbC-1]] Done.', false, ['WORK_ITEM']), [
    { type: 'text', value: 'Scheduled. ' },
    { type: 'marker', kind: 'WORK_ITEM', args: 'AbC-1' },
    { type: 'text', value: ' Done.' },
  ]);
  assert.deepEqual(splitAnswerMarkers('[[secret_variable:abc:0123456789abcdef]]', false, ['SECRET_VARIABLE']), [
    { type: 'marker', kind: 'SECRET_VARIABLE', args: 'abc:0123456789abcdef' },
  ]);
});

test('a marker no host names stays prose, as it always did', () => {
  assert.deepEqual(splitAnswerMarkers('See [[WORK_ITEM:x]]'), [{ type: 'text', value: 'See [[WORK_ITEM:x]]' }]);
  assert.equal(stripAnswerMarkers('See [[WORK_ITEM:x]]'), 'See [[WORK_ITEM:x]]');
});

test('a host naming a built-in marker takes it over, slide reference included', () => {
  assert.deepEqual(splitAnswerMarkers('[[PRESENTATION:D1#/s2]]', false, ['PRESENTATION']), [
    { type: 'marker', kind: 'PRESENTATION', args: 'D1#/s2' },
  ]);
  assert.deepEqual(splitAnswerMarkers('[[PRESENTATION:D1#/s2]]'), [{ type: 'artifact', kind: 'presentation', id: 'd1', slideRef: 's2' }]);
});

test('a host marker cut mid-stream never shows, and is stripped for copy', () => {
  assert.deepEqual(splitAnswerMarkers('Working [[WORK_IT', true, ['WORK_ITEM']), [{ type: 'text', value: 'Working ' }]);
  assert.deepEqual(splitAnswerMarkers('Working [[WORK_ITEM:ab', true, ['WORK_ITEM']), [{ type: 'text', value: 'Working ' }]);
  assert.equal(stripAnswerMarkers('Done [[WORK_ITEM:a]] and [[FILE:f]]', ['WORK_ITEM']), 'Done  and');
});

test("an agent's icon shows when it is an image URL or an emoji", () => {
  assert.equal(agentIconKind('https://x.test/a.png'), 'image');
  assert.equal(agentIconKind('data:image/png;base64,AAA'), 'image');
  assert.equal(agentIconKind('🕵️'), 'emoji');
  assert.equal(agentIconKind('shield-check'), null);
  assert.equal(agentIconKind(null), null);
  assert.equal(agentIconKind('javascript:alert(1)'), null);
});

test('agents are grouped in first-seen order, the ungrouped first', () => {
  const groups = groupAgents([{ id: 'f', group: 'Flows' }, { id: 'a' }, { id: 'g', group: 'Agents' }, { id: 'f2', group: 'Flows' }]);
  assert.deepEqual(
    groups.map((g) => [g.group, g.agents.map((a) => a.id)]),
    [
      [null, ['a']],
      ['Flows', ['f', 'f2']],
      ['Agents', ['g']],
    ],
  );
});
