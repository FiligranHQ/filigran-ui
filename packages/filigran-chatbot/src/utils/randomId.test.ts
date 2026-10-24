/**
 * Unit tests for the random id - `yarn test`: a v4 UUID with or without
 * `crypto.randomUUID`, which an insecure page lacks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { randomId } from './randomId.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('a v4 UUID where randomUUID exists', () => {
  assert.match(randomId(), UUID_V4);
});

test('a v4 UUID from random bytes where it does not, as on an insecure page', () => {
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const ids = new Set(Array.from({ length: 50 }, () => randomId()));
    assert.equal(ids.size, 50);
    for (const id of ids) assert.match(id, UUID_V4);
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  }
});
