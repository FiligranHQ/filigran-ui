/**
 * The panel's default danger and warning tones read at 4.5:1 in the light mode,
 * under the 6 % wash a notice paints (ChatNotice): red-600 measured 3.8:1 and
 * amber-700 4.1:1 on gray-100 (XTM-One-Platform/xtm-one#10911 UX round 1, B2),
 * red-700 and amber-800 5.1:1 and 5.8:1. A host that passes `theme.danger` /
 * `theme.warning` overrides both; this holds the unset defaults.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/assets/index.css', import.meta.url)), 'utf8');

function lightDefault(name) {
  const block = SOURCE.slice(SOURCE.indexOf('.filigran-chatbot {'), SOURCE.indexOf('.dark .filigran-chatbot {'));
  const match = block.match(new RegExp(`--chat-${name}: var\\(--filigran-chat-${name}, var\\(--color-([a-z]+-\\d+)\\)\\);`));
  assert.ok(match, `the light --chat-${name} default is gone from index.css`);
  return match[1];
}

test('the light danger default is red-700, the step that reads at 4.5:1 under a notice wash', () => {
  assert.equal(lightDefault('danger'), 'red-700');
});

test('the light warning default is amber-800, the step that reads at 4.5:1 under a notice wash', () => {
  assert.equal(lightDefault('warning'), 'amber-800');
});
