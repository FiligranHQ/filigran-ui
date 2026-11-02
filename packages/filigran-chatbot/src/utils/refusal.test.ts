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
  assert.equal(refusalDetail(null), null);
});

test("without a detail, a refusal's error is read when a string", () => {
  assert.equal(refusalDetail({ error: 'Quota exceeded.' }), 'Quota exceeded.');
  assert.equal(refusalDetail({ detail: 'From detail.', error: 'From error.' }), 'From detail.');
  assert.equal(refusalDetail({ detail: { code: 'x' }, error: 'From error.' }), 'From error.');
  assert.equal(refusalDetail({ detail: [{ msg: 'field required' }], error: 'From error.' }), 'From error.');
  assert.equal(refusalDetail({ error: { message: 'An object.' } }), null);
  assert.equal(refusalDetail({ error: ['A list.'] }), null);
  assert.equal(refusalDetail({ error: '  ' }), null);
  assert.equal(refusalDetail({ error: 'x'.repeat(501) }), null);
});

test("an error that is a code or reason phrase is not read: the panel's own message shows", () => {
  assert.equal(refusalDetail({ error: 'invalid_token' }), null);
  assert.equal(refusalDetail({ error: 'Unauthorized', status: 401 }), null);
  assert.equal(refusalDetail({ error: 'Not Found', status: 404, path: '/x' }), null);
  assert.equal(refusalDetail({ error: 'invalid_token', error_description: 'The access token expired' }), null);
  assert.equal(refusalDetail({ detail: 'From detail.', error: 'Unauthorized', status: 401 }), 'From detail.');
});

test('a body that is not JSON has no detail', async () => {
  assert.equal(await readRefusalDetail(new Response('<html>Bad gateway</html>', { status: 502 })), null);
  assert.equal(await readRefusalDetail(new Response(JSON.stringify({ detail: 'Refused.' }), { status: 403 })), 'Refused.');
  assert.equal(await readRefusalDetail(new Response(JSON.stringify({ error: 'Access refused.' }), { status: 403 })), 'Access refused.');
});

test('the headers key changes with the headers, not with their order', () => {
  assert.equal(requestHeadersKey({ a: '1', b: '2' }), requestHeadersKey({ b: '2', a: '1' }));
  assert.notEqual(requestHeadersKey({ Authorization: 'Bearer old' }), requestHeadersKey({ Authorization: 'Bearer new' }));
  assert.equal(requestHeadersKey(undefined), '');
});
