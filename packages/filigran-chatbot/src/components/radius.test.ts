/**
 * The panel's corners come from the design system alone - `yarn test`: no
 * component draws a Tailwind corner size (`rounded`, `rounded-md`, `rounded-xl`,
 * `rounded-[10px]`...) or an inline radius; each reads `chat-radius-sm` (a
 * control, a chip, an avatar tile) or `chat-radius-md` (a card, a bubble, a
 * status indicator, a menu, a dialog), the host's `--radius-sm` / `--radius-md`
 * through the theme. A full round (`rounded-full`, `rounded-l-full`: a dot, a
 * pill, a spinner, a gauge) and `rounded-[inherit]` stay.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ALLOWED = new Set(['rounded-full', 'rounded-[inherit]']);
const CORNER = /(?<![\w/-])rounded(?:-[a-z0-9]+)*(?:-\[[^\]]*\])?(?=[\s"'`:]|$)/g;

test('no component draws a corner outside the design-system radius tokens', () => {
  const offenders: string[] = [];
  for (const name of readdirSync(here)) {
    if (!name.endsWith('.tsx') || name.includes('.test.')) continue;
    const lines = readFileSync(join(here, name), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [corner] of line.matchAll(CORNER)) {
        if (!ALLOWED.has(corner) && !corner.endsWith('-full')) offenders.push(`${name}:${i + 1} ${corner}`);
      }
      if (/borderRadius\s*:/.test(line)) offenders.push(`${name}:${i + 1} borderRadius`);
    });
  }
  assert.deepEqual(offenders, []);
});
