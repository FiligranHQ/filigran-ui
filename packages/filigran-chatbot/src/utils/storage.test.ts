/**
 * Unit tests for the panel's browser-storage keys - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from './storage.ts';

test('without a prefix the keys are the historical ones', () => {
  assert.equal(storageKey(undefined, STORAGE_KEYS.conversationId), 'filigranChatConversationId');
  assert.equal(storageKey('', STORAGE_KEYS.agentSlug), 'filigranChatAgentSlug');
});

test('a prefix namespaces every key', () => {
  assert.equal(storageKey('xtm-chat', STORAGE_KEYS.conversationId), 'xtm-chat:filigranChatConversationId');
  assert.equal(storageKey('xtm-chat', `${STORAGE_KEYS.draft}new`), 'xtm-chat:filigranChatDraft:new');
});

test('no storage at all reads nothing and writes nowhere, without throwing', () => {
  assert.equal(readStorage('local', 'k'), null);
  assert.doesNotThrow(() => writeStorage('session', 'k', 'v'));
});
