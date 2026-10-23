/**
 * Unit tests for the `@filigran/chatbot/markdown` entry point - `yarn test`:
 * what it exports, that its answer-marker helpers read markers as the panel
 * does, and that it stays free of React and of side effects, so a host can
 * import it on an eagerly loaded page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as markdown from './markdown.ts';
import type { AnswerPart } from './markdown.ts';

test('the entry point exports the markdown and answer-marker helpers, and nothing else', () => {
  assert.deepEqual(Object.keys(markdown).sort(), [
    'hardenNestedCodeFences',
    'markdownUrlTransform',
    'markerKinds',
    'normalizeImageMarkdown',
    'normalizeMarkdownTables',
    'prepareMarkdown',
    'splitAnswerMarkers',
    'stripAnswerMarkers',
    'wrapBareJson',
  ]);
});

test('prepareMarkdown applies the helpers in the panel’s order', () => {
  const { hardenNestedCodeFences, normalizeImageMarkdown, normalizeMarkdownTables, prepareMarkdown, wrapBareJson } = markdown;
  // Alt text spread over lines that look like a table: flattened first, no table is "repaired" in it.
  assert.equal(prepareMarkdown('| x | ![alt\n|---|\nmore](u) |'), '| x | ![alt |---| more](u) |');
  // A table inside a markdown block with nested fences: read before the block's fence is lengthened.
  assert.equal(
    prepareMarkdown('```markdown\n# Doc\n```js\nx\n```\n| a | b |\n|---|\n```'),
    '````markdown\n# Doc\n```js\nx\n```\n| a | b |\n| --- | --- |\n````',
  );
  for (const content of ['{"a": [1, 2]}', '![a\nb](u)\n\n| a | b |\n|---|\n| 1 | 2 |', 'plain *prose*']) {
    assert.equal(prepareMarkdown(content), hardenNestedCodeFences(normalizeMarkdownTables(wrapBareJson(normalizeImageMarkdown(content)))));
  }
});

test('a host reads the markers of an answer as the panel does, its own kinds included', () => {
  const kinds = markdown.markerKinds(['work_item', 'bad-name']);
  assert.deepEqual(kinds, ['WORK_ITEM']);
  const parts: AnswerPart[] = markdown.splitAnswerMarkers('See [[FILE:f1]] and [[work_item:W-1]] then [[REPORT:R1]] end', false, kinds);
  assert.deepEqual(parts, [
    { type: 'text', value: 'See ' },
    { type: 'file', fileId: 'f1' },
    { type: 'text', value: ' and ' },
    { type: 'marker', kind: 'WORK_ITEM', args: 'W-1' },
    { type: 'text', value: ' then ' },
    { type: 'artifact', kind: 'report', id: 'r1', slideRef: undefined },
    { type: 'text', value: ' end' },
  ]);
  assert.equal(markdown.stripAnswerMarkers('Done. [[WORK_ITEM:W-1]]\n\n[[VIDEO:v', kinds), 'Done.');
  assert.deepEqual(markdown.splitAnswerMarkers('Writing [[PRES', true), [{ type: 'text', value: 'Writing ' }], 'a marker cut mid-stream never shows');
  assert.equal(markdown.stripAnswerMarkers('  indented prose\n'), '  indented prose\n', 'prose without markers is untouched');
});

test('the entry point pulls in no React, no stylesheet and nothing with side effects', () => {
  for (const file of ['./markdown.ts', './utils/index.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)].map((m) => ({ statement: m[0], from: m[1] }));
    assert.ok(imports.length > 0, `${file}: its imports were read`);
    for (const { statement, from } of imports) {
      assert.ok(!/react|\.css$/.test(from), `${file} imports ${from}`);
      // Values come only from the pure helpers themselves; anything else is a type.
      if (file === './utils/index.ts') assert.match(statement, /^import type /, `${file}: ${statement}`);
    }
    assert.ok(!/^import\s+'/m.test(source), `${file} has a side-effect import`);
  }
});
