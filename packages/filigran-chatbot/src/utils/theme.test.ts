/**
 * Unit tests for the host's theme - `yarn test`: each entry given a value sets
 * its variable on the panel root, and nothing else is set.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { themeVariables } from './theme.ts';

test('a theme sets the variables of the entries it gives a value, and only those', () => {
  assert.deepEqual(themeVariables({ surface: 'var(--bg)', userText: 'inherit', textSize: '1rem', border: ' ', text: undefined }), {
    '--filigran-chat-surface': 'var(--bg)',
    '--filigran-chat-user-text': 'inherit',
    '--filigran-chat-text-size': '1rem',
  });
});

test('no theme sets nothing', () => {
  assert.deepEqual(themeVariables(undefined), {});
  assert.deepEqual(themeVariables({}), {});
});
