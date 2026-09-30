/**
 * Unit tests for the time under a chat message - `yarn test`.
 *
 * Dates are built in local time, like the footer reads them, so the tests
 * hold in any time zone. ICU puts a narrow no-break space before "PM"; the
 * assertions compare with every space folded to a plain one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatMessageTime } from './messageTime.ts';

const plain = (s: string) => s.replace(/\s/g, ' ');
const now = new Date(2026, 8, 30, 18, 0);

test('a message from today shows its time alone', () => {
  const time = formatMessageTime(new Date(2026, 8, 30, 14, 5), 'en-US', now);
  assert.ok(time);
  assert.equal(plain(time.label), '02:05 PM');
  assert.equal(formatMessageTime(new Date(2026, 8, 30, 14, 5), 'fr', now)?.label, '14:05');
});

test('an older message leads with a short date, and the year once it is another one', () => {
  const yesterday = formatMessageTime(new Date(2026, 8, 29, 14, 5), 'en-US', now);
  assert.ok(yesterday);
  assert.equal(plain(yesterday.label), 'Sep 29, 02:05 PM');
  assert.ok(!yesterday.label.includes('2026'));

  const lastYear = formatMessageTime(new Date(2025, 11, 31, 9, 30), 'en-US', now);
  assert.ok(lastYear);
  assert.ok(lastYear.label.includes('2025'), lastYear.label);
  assert.ok(lastYear.label.includes('Dec'), lastYear.label);
});

test('the locale decides the order and the words', () => {
  const fr = formatMessageTime(new Date(2026, 8, 29, 14, 5), 'fr', now);
  assert.ok(fr);
  assert.match(fr.label, /^29 sept\./);
  assert.ok(fr.label.includes('14:05'), fr.label);
  const full = formatMessageTime(new Date(2026, 8, 29, 14, 5), 'fr', now)?.full ?? '';
  assert.ok(full.toLowerCase().includes('mardi'), full);
});

test('the tooltip spells the whole date and the iso form is machine-readable', () => {
  const date = new Date(2026, 8, 30, 14, 5);
  const time = formatMessageTime(date, 'en-US', now);
  assert.ok(time);
  assert.equal(plain(time.full), 'Wednesday, September 30, 2026 at 2:05 PM');
  assert.equal(time.iso, date.toISOString());
});

test('an invalid date or locale never throws', () => {
  assert.equal(formatMessageTime(new Date('not a date'), 'en-US', now), null);
  const time = formatMessageTime(new Date(2026, 8, 30, 14, 5), 'not a locale!!', now);
  assert.ok(time && time.label.length > 0);
  assert.ok(formatMessageTime(new Date(2026, 8, 30, 14, 5), undefined, now)?.label);
});
