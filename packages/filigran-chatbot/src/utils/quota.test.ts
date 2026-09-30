/**
 * Unit tests for the composer quota payload - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseQuota, quotaPeriodLabel } from './quota.ts';

test('the quota route payload is read with its scope', () => {
  assert.deepEqual(parseQuota({ used: 12, limit: 100, period: 'monthly', scope: 'global' }), {
    used: 12,
    limit: 100,
    period: 'monthly',
    scope: 'global',
  });
  assert.deepEqual(parseQuota({ used: 3, limit: 10, period: 'daily', scope: 'user' }), { used: 3, limit: 10, period: 'daily', scope: 'user' });
});

test('a missing or unknown scope reads as none, a missing limit as no ceiling', () => {
  assert.deepEqual(parseQuota({ used: 3, period: 'daily' }), { used: 3, limit: null, period: 'daily' });
  assert.deepEqual(parseQuota({ used: 3, limit: null, period: 'daily', scope: 'team' }), { used: 3, limit: null, period: 'daily' });
  assert.deepEqual(parseQuota({ used: 3 }), { used: 3, limit: null, period: '' });
});

test('nothing to show is no indicator', () => {
  assert.equal(parseQuota(null), null);
  assert.equal(parseQuota('12'), null);
  assert.equal(parseQuota({ limit: 10 }), null);
});

test('the known periods are translated, any other is shown as sent', () => {
  const t = (key: string) => `<${key}>`;
  assert.equal(quotaPeriodLabel('daily', t), '<today>');
  assert.equal(quotaPeriodLabel('monthly', t), '<this month>');
  assert.equal(quotaPeriodLabel('yearly', t), '<this year>');
  assert.equal(quotaPeriodLabel('per sprint', t), 'per sprint');
  assert.equal(quotaPeriodLabel('', t), '');
});
