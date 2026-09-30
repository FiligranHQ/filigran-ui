/**
 * Unit tests for persisted message feedback - `yarn test`.
 *
 * The URLs and bodies are a cross-repo contract: XTM One serves them and the
 * OpenCTI / OpenAEV proxies forward them as written here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  feedbackBaseUrl,
  feedbackModeOf,
  feedbackRequest,
  feedbackValueOf,
  normalizeFeedbackComment,
  ratingOf,
  shownFeedback,
  submitFeedback,
} from './feedback.ts';

test('the thumbs map onto the stored ratings and back', () => {
  assert.equal(ratingOf('up'), 'positive');
  assert.equal(ratingOf('down'), 'negative');
  assert.equal(feedbackValueOf('positive'), 'up');
  assert.equal(feedbackValueOf('negative'), 'down');
});

test('the panel stores feedback only where the host named the route', () => {
  assert.equal(feedbackBaseUrl('/api/chatbot', { feedback: '/conversations' }, 'rest'), '/api/chatbot/conversations');
  assert.equal(feedbackBaseUrl('/api/chatbot', {}, 'rest'), null);
  assert.equal(feedbackBaseUrl('/api/chatbot', undefined, 'rest'), null);
  assert.equal(feedbackBaseUrl('/api/chatbot', { feedback: null }, 'rest'), null);
  assert.equal(feedbackBaseUrl('/api/chatbot', { feedback: '/conversations', singleEndpoint: true }, 'rest'), null);
  assert.equal(feedbackBaseUrl('/api/chatbot', { feedback: '/conversations' }, 'legacy'), null);
  assert.equal(feedbackBaseUrl('/api/chatbot', { feedback: '/conversations' }, 'ag-ui'), null);
});

test('a rating is a POST of the rating and the normalized comment', () => {
  const { url, init } = feedbackRequest(
    '/api/chatbot/conversations',
    'c-1',
    'm-1',
    { rating: 'negative', comment: '  missing the second actor  ' },
    { 'X-Tenant': 't1' },
  );
  assert.equal(url, '/api/chatbot/conversations/c-1/messages/m-1/feedback');
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'include');
  assert.deepEqual(init.headers, { 'Content-Type': 'application/json', 'X-Tenant': 't1' });
  assert.deepEqual(JSON.parse(String(init.body)), { rating: 'negative', comment: 'missing the second actor' });

  const up = feedbackRequest('/b', 'c', 'm', { rating: 'positive', comment: null });
  assert.deepEqual(JSON.parse(String(up.init.body)), { rating: 'positive', comment: null });
});

test('a retraction is a DELETE on the same URL, with no body', () => {
  const { url, init } = feedbackRequest('/api/chatbot/conversations', 'c-1', 'm-1', null, { 'X-Tenant': 't1' });
  assert.equal(url, '/api/chatbot/conversations/c-1/messages/m-1/feedback');
  assert.equal(init.method, 'DELETE');
  assert.equal(init.credentials, 'include');
  assert.deepEqual(init.headers, { 'X-Tenant': 't1' });
  assert.equal(init.body, undefined);
});

test('ids are encoded into the path', () => {
  assert.equal(feedbackRequest('/b', 'a/b', 'c?d', null).url, '/b/a%2Fb/messages/c%3Fd/feedback');
});

test('the thumbs show where the rating can be stored, and only there', () => {
  // The panel stores it: needs the conversation and the answer's persisted id.
  assert.equal(feedbackModeOf('m-1', '/b', 'c-1', false), 'persisted');
  assert.equal(feedbackModeOf('m-1', '/b', 'c-1', true), 'persisted');
  assert.equal(feedbackModeOf(undefined, '/b', 'c-1', true), null);
  assert.equal(feedbackModeOf('m-1', '/b', null, true), null);
  // The host stores it.
  assert.equal(feedbackModeOf(undefined, null, null, true), 'callback');
  assert.equal(feedbackModeOf('m-1', undefined, 'c-1', true), 'callback');
  // Nobody does.
  assert.equal(feedbackModeOf('m-1', null, 'c-1', false), null);
});

test('a rating given before the conversation was reopened is shown and locked', () => {
  assert.deepEqual(shownFeedback(undefined, undefined), { value: null, locked: false });
  assert.deepEqual(shownFeedback(undefined, { rating: 'negative', comment: 'x' }), { value: 'down', locked: true });
  // What the user did in this session wins, a retraction included.
  assert.deepEqual(shownFeedback({ value: 'up' }, { rating: 'negative', comment: null }), { value: 'up', locked: false });
  assert.deepEqual(shownFeedback({ value: null }, { rating: 'positive', comment: null }), { value: null, locked: false });
});

test('a rating is stored only when the backend says so', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const answering =
    (ok: boolean) =>
    async (url: string, init: RequestInit): Promise<{ ok: boolean }> => {
      calls.push({ url, init });
      return { ok };
    };
  assert.equal(await submitFeedback(answering(true), '/b', 'c', 'm', { rating: 'positive', comment: null }), true);
  assert.equal(calls[0].url, '/b/c/messages/m/feedback');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(await submitFeedback(answering(false), '/b', 'c', 'm', null), false);
  assert.equal(calls[1].init.method, 'DELETE');
  const failing = async (): Promise<{ ok: boolean }> => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal(await submitFeedback(failing, '/b', 'c', 'm', null), false);
});

test('a comment is trimmed, capped, and null when empty', () => {
  assert.equal(normalizeFeedbackComment('  hi  '), 'hi');
  assert.equal(normalizeFeedbackComment('   '), null);
  assert.equal(normalizeFeedbackComment(null), null);
  assert.equal(normalizeFeedbackComment(undefined), null);
  assert.equal(normalizeFeedbackComment('x'.repeat(FEEDBACK_COMMENT_MAX_LENGTH + 50))?.length, FEEDBACK_COMMENT_MAX_LENGTH);
});
