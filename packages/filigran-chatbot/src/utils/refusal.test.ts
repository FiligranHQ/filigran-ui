import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRefusalDetail, refusalDetail, requestHeadersKey } from './refusal.ts';

test("a refusal's detail is read as a string, or from an object's message or detail", () => {
  assert.equal(refusalDetail({ detail: 'Rate limit reached.' }), 'Rate limit reached.');
  assert.equal(refusalDetail({ detail: { code: 'pack_invalid', message: 'Unknown pack.' } }), 'Unknown pack.');
  assert.equal(refusalDetail({ detail: { code: 'x', detail: 'Nested words.' } }), 'Nested words.');
  assert.equal(refusalDetail({ detail: '  ' }), null);
  assert.equal(refusalDetail({ detail: [{ loc: ['body'], msg: 'field required' }] }), null);
  assert.equal(refusalDetail({ detail: 'x'.repeat(501) }), null);
  assert.equal(refusalDetail({ error: 'no detail' }), null);
  assert.equal(refusalDetail(null), null);
});

test('a body that is not JSON has no detail', async () => {
  assert.equal(await readRefusalDetail(new Response('<html>Bad gateway</html>', { status: 502 })), null);
  assert.equal(await readRefusalDetail(new Response(JSON.stringify({ detail: 'Refused.' }), { status: 403 })), 'Refused.');
});

test('the headers key changes with the headers, not with their order', () => {
  assert.equal(requestHeadersKey({ a: '1', b: '2' }), requestHeadersKey({ b: '2', a: '1' }));
  assert.notEqual(requestHeadersKey({ Authorization: 'Bearer old' }), requestHeadersKey({ Authorization: 'Bearer new' }));
  assert.equal(requestHeadersKey(undefined), '');
});
