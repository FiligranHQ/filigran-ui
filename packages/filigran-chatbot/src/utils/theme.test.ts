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

test('the composer entries set its corners, resting height and focus ring', () => {
  assert.deepEqual(themeVariables({ inputRadius: 'var(--radius-sm)', inputMinHeight: '4rem', focusRing: 'var(--color-focus)' }), {
    '--filigran-chat-input-radius': 'var(--radius-sm)',
    '--filigran-chat-input-min-height': '4rem',
    '--filigran-chat-focus-ring': 'var(--color-focus)',
  });
});

test('the composer hover border entry sets its variable', () => {
  assert.deepEqual(themeVariables({ inputBorderHover: 'var(--border-input-hover)' }), {
    '--filigran-chat-input-border-hover': 'var(--border-input-hover)',
  });
});

test('the menu surface entry sets its own variable, apart from the hover fill', () => {
  assert.deepEqual(themeVariables({ menuSurface: 'var(--bg-elevation-highlight)', surfaceHover: 'var(--bg-input-hover)' }), {
    '--filigran-chat-menu-surface': 'var(--bg-elevation-highlight)',
    '--filigran-chat-surface-hover': 'var(--bg-input-hover)',
  });
});

test('the menu active border entry sets the left track of the keyboard-active row', () => {
  assert.deepEqual(themeVariables({ menuActiveBorder: 'var(--border-input-hover)' }), {
    '--filigran-chat-menu-active-border': 'var(--border-input-hover)',
  });
});

test('the radius entries pass the design-system corners to every card and control', () => {
  assert.deepEqual(themeVariables({ radiusSm: 'var(--radius-sm)', radiusMd: 'var(--radius-md)' }), {
    '--filigran-chat-radius-sm': 'var(--radius-sm)',
    '--filigran-chat-radius-md': 'var(--radius-md)',
  });
});

test('the feedback entries pass the design-system danger, warning and success tones', () => {
  assert.deepEqual(themeVariables({ danger: 'var(--color-error)', warning: 'var(--color-warning)', success: 'var(--color-success)' }), {
    '--filigran-chat-danger': 'var(--color-error)',
    '--filigran-chat-warning': 'var(--color-warning)',
    '--filigran-chat-success': 'var(--color-success)',
  });
});

test('no theme sets nothing', () => {
  assert.deepEqual(themeVariables(undefined), {});
  assert.deepEqual(themeVariables({}), {});
});
