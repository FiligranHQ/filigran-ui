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
  assert.equal(refusalDetail({ statusCode: 429, error: 'Too Many Requests' }), null);
});

test('an error sentence is read in any script, not only one with spaces', () => {
  assert.equal(refusalDetail({ error: '配额已用完。' }), '配额已用完。');
  assert.equal(refusalDetail({ error: 'クォータを超えました。' }), 'クォータを超えました。');
});

test("without a detail, a body's own message beside its statusCode is read before its error", () => {
  const fastify = { statusCode: 429, error: 'Too Many Requests', message: 'Rate limit exceeded, retry in 1 minute' };
  assert.equal(refusalDetail(fastify), 'Rate limit exceeded, retry in 1 minute');
  assert.equal(refusalDetail({ statusCode: 403, message: 'From message.', error: 'Forbidden' }), 'From message.');
  assert.equal(refusalDetail({ detail: 'From detail.', statusCode: 403, message: 'From message.' }), 'From detail.');
  assert.equal(refusalDetail({ status: 500, error: 'Internal Server Error', message: '' }), null);
});

test("a message that is a gateway's reason phrase, or has no statusCode beside it, is not read", () => {
  // AWS API Gateway and Kong.
  assert.equal(refusalDetail({ message: 'Unauthorized' }), null);
  assert.equal(refusalDetail({ message: 'Too Many Requests' }), null);
  // NestJS, and Boom without a message of its own.
  assert.equal(refusalDetail({ statusCode: 401, message: 'Unauthorized' }), null);
  assert.equal(refusalDetail({ statusCode: 429, message: 'Too Many Requests' }), null);
  assert.equal(refusalDetail({ statusCode: 404, error: 'Not Found', message: 'Not Found' }), null);
  // An Express handler's `{ message: err.message }`.
  assert.equal(refusalDetail({ message: 'connect ECONNREFUSED 10.0.3.4:5432' }), null);
  // A sentence `error` beside a message that is not read still is.
  assert.equal(refusalDetail({ message: 'Unauthorized', error: 'Quota exceeded.' }), 'Quota exceeded.');
  // A reason phrase is not an error sentence either.
  assert.equal(refusalDetail({ error: 'Service Unavailable' }), null);
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
