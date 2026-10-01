/**
 * Unit tests for the composer's `@` conversation references - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_REFERENCE_SEARCH,
  MAX_REFERENCED_CONVERSATIONS,
  conversationReferencesUrl,
  insertConversationReference,
  parseReferenceCandidates,
  pruneConversationRefs,
  referenceMenuView,
  referenceSearchUrl,
  referenceTokens,
  referenceTrigger,
  referencedConversations,
  withConversationRef,
} from './conversationRefs.ts';
import type { ChatConversationRef, ChatConversationReferenceCandidate } from '../types';

const ref = (conversationId: string, key: string, title = key): ChatConversationRef => ({ conversationId, key, title });
const candidate = (id: string, key = id): ChatConversationReferenceCandidate => ({ id, key, title: key, isOwn: true });

test('an @ at the start or after a space opens the menu with what follows it', () => {
  assert.deepEqual(referenceTrigger('@'), { anchor: 0, query: '' });
  assert.deepEqual(referenceTrigger('see @q3-thr'), { anchor: 4, query: 'q3-thr' });
  assert.deepEqual(referenceTrigger('line one\n@wee'), { anchor: 9, query: 'wee' });
  assert.deepEqual(referenceTrigger('(@notes'), { anchor: 1, query: 'notes' });
});

test('an email, a word or a finished token does not open the menu', () => {
  assert.equal(referenceTrigger('mail a@b'), null);
  assert.equal(referenceTrigger('foo-@bar'), null);
  assert.equal(referenceTrigger('x_@y'), null);
  assert.equal(referenceTrigger('@q3-report '), null);
  assert.equal(referenceTrigger('no at sign'), null);
  // Only the last @ can be the one being typed.
  assert.equal(referenceTrigger('@a b@c'), null);
  assert.deepEqual(referenceTrigger('a@b @c'), { anchor: 4, query: 'c' });
});

test('the tokens of a message are read with the same rule, lowercased, once each', () => {
  assert.deepEqual(referenceTokens('Compare @Q3-Report with @weekly and @q3-report, not a@b'), ['q3-report', 'weekly']);
  assert.deepEqual(referenceTokens('@@key'), ['key']);
  assert.deepEqual(referenceTokens('a@b@c'), []);
  assert.deepEqual(referenceTokens('@'), []);
});

test('a pick is dropped once its @key is edited out of the text', () => {
  const refs = [ref('c-1', 'q3-report'), ref('c-2', 'weekly')];
  assert.equal(pruneConversationRefs(refs, 'see @q3-report and @weekly'), refs, 'nothing dropped: the same array');
  assert.deepEqual(pruneConversationRefs(refs, 'see @q3-report and @week'), [refs[0]]);
  assert.deepEqual(pruneConversationRefs(refs, 'mail me@weekly'), []);
  const none: ChatConversationRef[] = [];
  assert.equal(pruneConversationRefs(none, 'anything'), none);
});

test('the same conversation is recorded once', () => {
  const refs = [ref('c-1', 'q3-report')];
  assert.equal(withConversationRef(refs, ref('c-1', 'q3-report')), refs);
  assert.deepEqual(withConversationRef(refs, ref('c-2', 'weekly')), [refs[0], ref('c-2', 'weekly')]);
});

test('the payload follows the text: order of appearance, each once, picks only', () => {
  const refs = [ref('c-1', 'q3-report'), ref('c-2', 'weekly'), ref('c-3', 'unused')];
  assert.deepEqual(
    referencedConversations(refs, 'From @weekly, then @q3-report and @weekly again, and @typed-by-hand').map((r) => r.conversationId),
    ['c-2', 'c-1'],
  );
  assert.deepEqual(referencedConversations([], '@weekly'), []);
});

test('two conversations sharing a key are both sent while the key is there', () => {
  const refs = [ref('c-1', 'weekly-sync'), ref('c-2', 'weekly-sync')];
  assert.deepEqual(
    referencedConversations(refs, '@weekly-sync and @weekly-sync').map((r) => r.conversationId),
    ['c-1', 'c-2'],
  );
});

test(`a message references at most ${MAX_REFERENCED_CONVERSATIONS} conversations`, () => {
  const refs = Array.from({ length: 7 }, (_, i) => ref(`c-${i}`, `k${i}`));
  const text = refs.map((r) => `@${r.key}`).join(' ');
  assert.deepEqual(
    referencedConversations(refs, text).map((r) => r.conversationId),
    ['c-0', 'c-1', 'c-2', 'c-3', 'c-4'],
  );
});

test('a pick replaces the @partial, adds a space and puts the caret after it', () => {
  const text = 'see @q3';
  const trigger = referenceTrigger(text)!;
  assert.deepEqual(insertConversationReference(text, trigger, 'q3-threat-report'), { text: 'see @q3-threat-report ', caret: 22 });

  // In the middle of the text: what follows the caret is kept.
  const middle = 'see @we and more';
  const atCaret = referenceTrigger(middle.slice(0, 7))!;
  assert.deepEqual(insertConversationReference(middle, atCaret, 'weekly'), { text: 'see @weekly and more', caret: 12 });

  // A bare @ at the very start.
  assert.deepEqual(insertConversationReference('@', referenceTrigger('@')!, 'notes'), { text: '@notes ', caret: 7 });
});

test('the inserted token reads back as a reference', () => {
  const { text } = insertConversationReference('compare @q', referenceTrigger('compare @q')!, 'q3-report');
  assert.deepEqual(referenceTokens(text), ['q3-report']);
  assert.deepEqual(
    referencedConversations([ref('c-1', 'q3-report')], text).map((r) => r.conversationId),
    ['c-1'],
  );
});

test('candidates are parsed defensively', () => {
  assert.deepEqual(
    parseReferenceCandidates({
      conversations: [
        { id: 'c-1', title: ' Q3 threat report ', key: 'q3-threat-report', updated_at: '2026-09-30T10:00:00Z', is_own: true },
        { id: 'c-2', title: 'Shared brief', key: 'shared-brief', updated_at: null, is_own: false },
        { id: 'c-3', title: 'No own flag', key: 'no-own-flag' },
        { id: '', title: 'No id', key: 'no-id' },
        { id: 'c-4', title: 'Bad key', key: 'not a key' },
        { id: 'c-5', title: 'No key' },
        { id: 'c-1', title: 'Duplicate', key: 'duplicate' },
        null,
        'x',
      ],
    }),
    [
      { id: 'c-1', title: 'Q3 threat report', key: 'q3-threat-report', updatedAt: '2026-09-30T10:00:00Z', isOwn: true },
      { id: 'c-2', title: 'Shared brief', key: 'shared-brief', updatedAt: undefined, isOwn: false },
      { id: 'c-3', title: 'No own flag', key: 'no-own-flag', updatedAt: undefined, isOwn: true },
    ],
  );
  assert.deepEqual(parseReferenceCandidates([{ id: 'c-9', title: 'Bare', key: 'bare' }]).length, 1);
  assert.deepEqual(parseReferenceCandidates(null), []);
  assert.deepEqual(parseReferenceCandidates({ detail: 'Not found' }), []);
});

test('the feature is on only when the host names the route on the REST backend', () => {
  assert.equal(conversationReferencesUrl('/api/chat', undefined, 'rest'), null);
  assert.equal(conversationReferencesUrl('/api/chat', { conversationReferences: null }, 'rest'), null);
  assert.equal(conversationReferencesUrl('/api/chat', { conversationReferences: '' }, 'rest'), null);
  assert.equal(conversationReferencesUrl('/api/chat', { conversationReferences: '/refs', singleEndpoint: true }, 'rest'), null);
  assert.equal(conversationReferencesUrl('/api/chat', { conversationReferences: '/refs' }, 'legacy'), null);
  assert.equal(conversationReferencesUrl('/api/chat', { conversationReferences: '/refs' }, 'ag-ui'), null);
  assert.equal(
    conversationReferencesUrl('/api/chat', { conversationReferences: '/conversation-references' }, 'rest'),
    '/api/chat/conversation-references',
  );
});

test('the search names the typed text, the page size and the conversation written in', () => {
  assert.equal(referenceSearchUrl('/api/refs', 'q3 report', 'c-1'), '/api/refs?limit=8&q=q3+report&exclude=c-1');
  assert.equal(referenceSearchUrl('/api/refs', '', null), '/api/refs?limit=8');
  assert.equal(referenceSearchUrl('/api/refs?tenant=a', 'x'), '/api/refs?tenant=a&limit=8&q=x');
});

test('the menu: results, kept while the next ones load, then "no match" for a typed text only', () => {
  const trigger = { anchor: 0, query: 'q3' };
  const items = [candidate('c-1'), candidate('c-2')];
  const base = { trigger, dismissed: false, referenced: 0 };

  assert.deepEqual(referenceMenuView({ ...base, trigger: null, search: { query: 'q3', items, failed: false } }), { kind: 'closed' });
  assert.deepEqual(referenceMenuView({ ...base, dismissed: true, search: { query: 'q3', items, failed: false } }), { kind: 'closed' });
  assert.deepEqual(referenceMenuView({ ...base, search: { query: 'q3', items, failed: false } }), { kind: 'results', items });
  // The answer for "q" stays on screen while "q3" loads.
  assert.deepEqual(referenceMenuView({ ...base, search: { query: 'q', items, failed: false } }), { kind: 'results', items });
  // Nothing answered yet: no menu, not "no match".
  assert.deepEqual(referenceMenuView({ ...base, search: EMPTY_REFERENCE_SEARCH }), { kind: 'closed' });
  assert.deepEqual(referenceMenuView({ ...base, search: { query: 'q', items: [], failed: false } }), { kind: 'closed' });
  assert.deepEqual(referenceMenuView({ ...base, search: { query: 'q3', items: [], failed: false } }), { kind: 'empty' });
  // An empty @ with nothing to offer is no menu.
  assert.deepEqual(referenceMenuView({ ...base, trigger: { anchor: 0, query: '' }, search: { query: '', items: [], failed: false } }), {
    kind: 'closed',
  });
  // A failed search says nothing rather than "no match".
  assert.deepEqual(referenceMenuView({ ...base, search: { query: 'q3', items: [], failed: true } }), { kind: 'closed' });
});

test('the menu never offers the conversation written in, and says when the message is full', () => {
  const trigger = { anchor: 0, query: '' };
  const items = [candidate('c-1'), candidate('c-2')];
  assert.deepEqual(referenceMenuView({ trigger, dismissed: false, referenced: 0, exclude: 'c-1', search: { query: '', items, failed: false } }), {
    kind: 'results',
    items: [items[1]],
  });
  assert.deepEqual(
    referenceMenuView({ trigger, dismissed: false, referenced: MAX_REFERENCED_CONVERSATIONS, search: { query: '', items, failed: false } }),
    { kind: 'full' },
  );
});
