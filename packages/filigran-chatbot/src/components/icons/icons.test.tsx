/**
 * Every glyph of the panel comes from @filigran/design-system - `yarn test`:
 * no file of the package draws its own <svg> (save the documented
 * exceptions below), and the named icons render the design system's <Icon>
 * at one of its three designed sizes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

import * as icons from './index.tsx';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');

/**
 * Drawings that are not icons, so the design system has no glyph for them:
 * the context gauge is a ring whose arc is the fill ratio.
 */
const SVG_EXCEPTIONS = new Set(['components/ContextUsageIndicator.tsx']);

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });

test('no component draws its own <svg> outside the documented exceptions', () => {
  const offenders = sources(src)
    .map((path) => relative(src, path).split('\\').join('/'))
    .filter((path) => !SVG_EXCEPTIONS.has(path))
    .filter((path) => /<svg[\s>]/.test(readFileSync(join(src, path), 'utf8')));
  assert.deepEqual(offenders, []);
});

test('a requested size snaps to the 16, 20 or 24 px the design system draws', () => {
  assert.deepEqual(
    [10, 12, 13, 14, 16, 17, 18, 20, 22, 24, undefined].map(icons.snapIconSize),
    [16, 16, 16, 16, 16, 16, 20, 20, 24, 24, 24],
  );
});

test('every named icon renders the design-system glyph at a designed size', () => {
  const named = Object.entries(icons).filter(([name]) => name.endsWith('Icon'));
  assert.ok(named.length >= 50, 'the whole vocabulary of the panel');
  for (const [name, Component] of named) {
    const markup = renderToStaticMarkup(<Component size={14} />);
    assert.match(markup, /^<svg[^>]* width="16" height="16"/, `${name} is a 16 px DS glyph`);
    assert.match(markup, /aria-hidden="true"/, `${name} is decorative`);
    assert.match(markup, /class="[^"]*\bsize-4\b/, `${name} carries the DS size class`);
  }
});
