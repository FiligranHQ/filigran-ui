/**
 * Unit tests of which drags land in a field as text - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dropsAsText } from './drop.ts';

const PICTURE_FROM_A_PAGE = ['Files', 'text/uri-list', 'text/html'];

test('a picture dragged from a page lands in a text field as its address', () => {
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { tagName: 'TEXTAREA' } as unknown as EventTarget), true);
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { tagName: 'INPUT', type: 'search' } as unknown as EventTarget), true);
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { isContentEditable: true } as unknown as EventTarget), true);
});

test('a read-only or disabled field takes no drop, and neither does a file alone or a non-text field', () => {
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { tagName: 'TEXTAREA', readOnly: true } as unknown as EventTarget), false);
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { tagName: 'INPUT', type: 'text', disabled: true } as unknown as EventTarget), false);
  assert.equal(dropsAsText(['Files'], { tagName: 'TEXTAREA' } as unknown as EventTarget), false);
  assert.equal(dropsAsText(PICTURE_FROM_A_PAGE, { tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget), false);
});
