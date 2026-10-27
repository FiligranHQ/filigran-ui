/**
 * Unit tests for what a user's bubble shows - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { userMessageText } from './userMessage.ts';

test('the blank lines around a message go, its indent and inner breaks stay', () => {
  assert.equal(userMessageText('\n\n  first line\n\nsecond paragraph  \n\n'), '  first line\n\nsecond paragraph');
  assert.equal(userMessageText(' \t\r\n\r\nx\r\ny\r\n'), 'x\r\ny');
  assert.equal(userMessageText('  \n \t '), '');
});

test('a message padded with a long run of spaces is trimmed in linear time', () => {
  const padded = `a${' '.repeat(200_000)}b`;
  const started = performance.now();
  assert.equal(userMessageText(`${padded}  \n`), padded);
  // Linear: well under a millisecond. The quadratic `\s+$` took seconds here.
  assert.ok(performance.now() - started < 1000);
});
