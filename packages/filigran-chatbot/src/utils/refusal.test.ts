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

test("the products' proxies' error is read, beside a status or not", () => {
  // OpenCTI's proxy.
  assert.equal(refusalDetail({ status: 'error', error: 'Agent not found.' }), 'Agent not found.');
  assert.equal(refusalDetail({ status: 503, error: 'XTM One is unreachable.' }), 'XTM One is unreachable.');
  // OpenCRQ's.
  assert.equal(refusalDetail({ error: 'XTM One is not configured' }), 'XTM One is not configured');
});

test("an error that is a code is not read: the panel's own message shows", () => {
  assert.equal(refusalDetail({ error: 'invalid_token' }), null);
  assert.equal(refusalDetail({ error: 'Unauthorized' }), null);
  assert.equal(refusalDetail({ status: 401, error: 'Unauthorized' }), null);
  assert.equal(refusalDetail({ detail: 'From detail.', error: 'Unauthorized' }), 'From detail.');
});

test("an error that is a status's reason phrase is not read", () => {
  assert.equal(refusalDetail({ status: 404, error: 'Not Found' }), null);
  assert.equal(refusalDetail({ statusCode: 429, error: 'Too Many Requests' }), null);
  assert.equal(refusalDetail({ error: 'Internal Server Error' }), null);
  // A sentence in Title Case still has its punctuation or a lowercase word.
  assert.equal(refusalDetail({ error: 'XTM One is unreachable.' }), 'XTM One is unreachable.');
  assert.equal(refusalDetail({ error: 'Invalid conversation id' }), 'Invalid conversation id');
});

test('an error sentence is read in any script, not only one with spaces', () => {
  assert.equal(refusalDetail({ error: '配额已用完。' }), '配额已用完。');
  assert.equal(refusalDetail({ error: 'クォータを超えました。' }), 'クォータを超えました。');
});

test('a top-level message is not read: a gateway answers a reason phrase there, a handler its internal error', () => {
  assert.equal(refusalDetail({ message: 'Unauthorized' }), null);
  assert.equal(refusalDetail({ statusCode: 500, message: 'connect ECONNREFUSED 10.0.3.4:5432' }), null);
  assert.equal(refusalDetail({ statusCode: 404, message: 'Cannot POST /api/chat/cancel' }), null);
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
