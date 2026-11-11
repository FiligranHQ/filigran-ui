/**
 * The panel's layout by display mode and the conversation list's clamps -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatColumnClass, chatDisplayMode, chatGutterClass, LIST_RAIL_WIDTH, LIST_WIDTH, listLayout, MIN_CHAT_COLUMN, readsAsColumn } from './layout.ts';

test('a page and full screen read as a centred column, a docked panel and a floating window fill their width', () => {
  assert.equal(chatDisplayMode('inline'), 'page');
  assert.equal(chatDisplayMode('fullscreen'), 'fullscreen');
  assert.equal(chatDisplayMode('sidebar'), 'docked');
  assert.equal(chatDisplayMode('floating'), 'floating');
  for (const display of ['page', 'fullscreen'] as const) {
    assert.ok(readsAsColumn(display));
    assert.match(chatColumnClass(display), /\bmx-auto\b/);
    assert.match(chatColumnClass(display), /\bmax-w-200\b/, '800 px under a 1536 px panel');
    assert.match(chatColumnClass(display), /@min-\[96rem\]:max-w-220\b/, '880 px from a 1536 px panel on');
    assert.equal(chatGutterClass(display), 'px-6');
  }
  for (const display of ['docked', 'floating'] as const) {
    assert.ok(!readsAsColumn(display));
    assert.doesNotMatch(chatColumnClass(display), /max-w-/, 'never a max width in a panel');
    assert.match(chatGutterClass(display), /^px-3 @min-\[28rem\]:px-4$/, 'compact gutters by the panel width');
  }
});

test('the list keeps the chosen width within 220 to 360 px when the panel is not measured yet', () => {
  assert.deepEqual(listLayout(null, LIST_WIDTH.default), { max: 360, width: 260, rail: false });
  assert.equal(listLayout(null, 10).width, LIST_WIDTH.min);
  assert.equal(listLayout(null, 9999).width, LIST_WIDTH.max);
});

test('on a wide panel the list stops at 360 px', () => {
  assert.deepEqual(listLayout(2560, 9999), { max: 360, width: 360, rail: false });
});

test('the list never takes more than a quarter of the panel', () => {
  // 1280 / 4 = 320, and 1280 - 680 = 600: the quarter binds.
  assert.deepEqual(listLayout(1280, 360), { max: 320, width: 320, rail: false });
  assert.equal(listLayout(1280, 260).width, 260, 'the default fits');
});

test('the conversation keeps 680 px: the list shrinks to its minimum, then folds to its rail', () => {
  // 900: a quarter is 225, the conversation leaves 220: the minimum still fits.
  assert.deepEqual(listLayout(MIN_CHAT_COLUMN + LIST_WIDTH.min, 300), { max: 220, width: 220, rail: false });
  // One pixel less and the minimum would leave the conversation under 680 px.
  const tight = listLayout(MIN_CHAT_COLUMN + LIST_WIDTH.min - 1, 300);
  assert.equal(tight.rail, true);
  assert.equal(tight.width, LIST_RAIL_WIDTH);
  assert.equal(listLayout(420, 260).rail, true, 'a narrow full screen shows the rail');
});
