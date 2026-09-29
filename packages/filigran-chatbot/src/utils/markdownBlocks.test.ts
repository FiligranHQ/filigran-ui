/**
 * Unit tests for the streamed-answer block split - `yarn test`.
 *
 * The property that matters: rendering the blocks one after the other is the
 * markup one parse of the whole text produces, at every length the answer
 * passes through while it streams, whether the split is computed from scratch
 * or carried over from the previous length.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createElement, Fragment } from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { markdownUrlTransform, prepareMarkdown } from './index.ts';
import { MarkdownBlockSplitter, splitMarkdownBlocks, type MarkdownBlocks } from './markdownBlocks.ts';

/** What `MarkdownMessage` hands react-markdown, its element renderers aside. */
const OPTIONS = { remarkPlugins: [remarkGfm, remarkBreaks], urlTransform: markdownUrlTransform };

const SAMPLE = [
  '# Findings',
  '',
  'The actor reused **valid credentials** and moved to `FS-01`.',
  'Second line of the same paragraph.',
  '',
  '- first item',
  '- second item',
  '',
  '- loose item after a blank line',
  '  continued with indentation',
  '',
  '  a second paragraph in the item',
  '',
  '* another bullet starts another list',
  '',
  '1. ordered',
  '2. list',
  '   ```python',
  "   print('fence in a list item')",
  '',
  '   still code',
  '   ```',
  '',
  '10. wide marker',
  '',
  '   three spaces is not enough to continue it',
  '',
  '> a quote',
  'continued lazily',
  '',
  '> a second quote',
  '',
  '| Host | Seen |',
  '|---|---|',
  '| FS-01 | 09:12 |',
  '',
  'Setext heading',
  '==============',
  '',
  'Paragraph then an interrupting heading',
  '## Heading two',
  'Paragraph then #hashtag-looking text',
  '',
  '```',
  'code with a blank line',
  '',
  '# not a heading',
  '```',
  '',
  '    indented code',
  '',
  '    more indented code',
  '',
  '***',
  '',
  '<!-- a comment',
  '',
  'spanning a blank line -->',
  '',
  '- nested',
  '  - deeper',
  '',
  '        indented code inside the item',
  '',
  'Final paragraph with a [link](https://example.com) and ~~strike~~.',
  '',
  '```ts',
  "const unclosed = 'fence runs to the end';",
  '',
  'still inside',
].join('\n');

const INTERRUPTIONS = [
  'Para',
  '#x then text',
  '',
  'Para',
  '# real heading',
  '',
  'Para',
  '- item',
  '',
  '- b',
  '',
  '+ c',
  '',
  '    top-level indented code',
  '',
  '2. read as text after indented code',
  '',
  '\tcode after a tab',
  '',
  '- read as text too',
  '',
  '<div>',
  'raw html',
  '</div>',
  '',
  '* after html',
].join('\n');

/**
 * What the panel's preprocessing rewrites as an answer streams: a table whose
 * delimiter row miscounts its columns, a delimiter row repaired while it is
 * being written and left alone once complete, a markdown fence holding fences
 * of its own, an image whose alt text spans lines. The prepared text of one
 * length then does not always extend the prepared text of the one before.
 */
const PANEL = [
  'Here is the summary.',
  '',
  '| Host | Seen | Technique |',
  '|---|---|',
  '| FS-01 | 09:12 | T1021 |',
  '',
  '| Asset | Owner |',
  '|---|---|',
  '| DC-01 | IT |',
  '',
  '```markdown',
  '# Prompt',
  '',
  '```python',
  "print('nested')",
  '```',
  '',
  'Closing prose inside the document.',
  '```',
  '',
  '![A chart of the',
  'lateral movement](data:image/png;base64,iVBORw0KGgo=)',
  '',
  'Final line with `code` and a [relative link](/dashboard/id/1).',
].join('\n');

/** An answer that is one JSON document, which the panel wraps in a fence once it parses. */
const BARE_JSON = ['{', '  "hosts": ["FS-01", "DC-01"],', '  "note": "a *starred* value",', '  "count": 2', '}'].join('\n');

/** Text that looks like a definition and is not one: it must not cost the split. */
const LOOKALIKES = [
  'A regex: `[^a-z]+`, and [^a-z] in prose.',
  '',
  '```ts',
  'interface Row {',
  '  [key: string]: unknown;',
  '}',
  '> [docs]: /inside-a-fence',
  '```',
  '',
  '    [docs]: /indented-code',
  '',
  'Between.',
  '',
  '> a quoted paragraph',
  '[docs]: /a-lazy-continuation-line',
  '',
  'See [docs].',
].join('\n');

/**
 * Definitions a line-start pattern misses: in a quote or a list item, nested,
 * with a label spanning lines or holding an escaped bracket. Each with a
 * reference that uses it.
 */
const DEFINITIONS: ReadonlyArray<[definition: string, use: string]> = [
  ['> [docs]: /guide', '[the docs][docs]'],
  ['- [docs]: /guide', '[the docs][docs]'],
  ['1. [docs]: /guide', '[the docs][docs]'],
  ['> > [docs]: /guide', '[the docs][docs]'],
  ['>[docs]: /guide', '[docs]'],
  ['  > - [docs]: /guide "The guide"', '[docs][]'],
  ['- an item\n\n  [docs]: /guide', '[the docs][docs]'],
  ['[docs\nguide]: /guide', '[the docs][docs guide]'],
  ['[a\\]b]: /guide', '[the docs][a\\]b]'],
  ['> [^1]: A note in a quote.', 'A claim.[^1]'],
  ['- [^1]: A note in a list item.', 'A claim.[^1]'],
];

function render(markdown: string): string {
  return renderToString(createElement(ReactMarkdown, { ...OPTIONS, children: markdown }));
}

function renderBlocks(blocks: string[]): string {
  return renderToString(
    createElement(Fragment, null, ...blocks.map((block, index) => createElement(ReactMarkdown, { key: index, ...OPTIONS, children: block }))),
  );
}

/**
 * A newline next to a tag is not rendered: between two blocks, or around the
 * text raw HTML is rendered as. React separates adjacent text nodes.
 */
function normalized(html: string): string {
  return html
    .replace(/<!-- -->/g, '')
    .replace(/\n+(?=<)/g, '')
    .replace(/>\n+/g, '>')
    .trim();
}

/**
 * The lengths worth checking while *text* streams: the first characters of
 * every line, where a line being written can still change meaning (`#`, `1`,
 * `10.`, `*`), and every line end, with and without its newline.
 */
function prefixes(text: string): string[] {
  const lengths = new Set<number>();
  let start = 0;
  for (const line of text.split('\n')) {
    for (let extra = 1; extra <= Math.min(4, line.length); extra++) lengths.add(start + extra);
    lengths.add(start + line.length);
    lengths.add(Math.min(text.length, start + line.length + 1));
    start += line.length + 1;
  }
  return [...lengths]
    .filter((length) => length > 0)
    .sort((a, b) => a - b)
    .map((length) => text.slice(0, length));
}

const CASES: ReadonlyArray<[name: string, text: string, prepare: (text: string) => string]> = [
  ['sample', SAMPLE, (text) => text],
  ['interruptions', INTERRUPTIONS, (text) => text],
  ['panel preprocessing', PANEL, prepareMarkdown],
  ['bare JSON', BARE_JSON, prepareMarkdown],
  ['look-alike definitions', LOOKALIKES, (text) => text],
];

for (const [name, text, prepare] of CASES) {
  test(`${name}: every streamed length renders block by block as it renders whole`, () => {
    for (const prefix of prefixes(text)) {
      const source = prepare(prefix);
      const { blocks } = splitMarkdownBlocks(source);
      assert.equal(blocks.join(''), source);
      assert.equal(normalized(renderBlocks(blocks)), normalized(render(source)), prefix);
    }
  });

  test(`${name}: the carried-over split is the split from scratch`, () => {
    let previous: MarkdownBlocks | null = null;
    for (const prefix of prefixes(text)) {
      const source = prepare(prefix);
      const carried: MarkdownBlocks = splitMarkdownBlocks(source, previous);
      assert.deepEqual(carried, splitMarkdownBlocks(source), prefix);
      previous = carried;
    }
  });
}

test('the sample splits into many blocks, so a growing answer re-renders only its end', () => {
  const { blocks, settled } = splitMarkdownBlocks(SAMPLE);
  assert.ok(blocks.length >= 15, `only ${blocks.length} blocks`);
  assert.ok(settled >= blocks.length - 2);
});

test('a fence left open keeps everything after it in one block', () => {
  const { blocks } = splitMarkdownBlocks('Intro\n\n```\ncode\n\n# still code\n\nmore');
  assert.deepEqual(blocks, ['Intro\n\n', '```\ncode\n\n# still code\n\nmore']);
});

test('a heading that interrupts a paragraph stays open with it until a blank line', () => {
  const split = splitMarkdownBlocks('Para\n#');
  assert.equal(split.settled, 0);
  assert.deepEqual(splitMarkdownBlocks('Para\n#x', split).blocks, ['Para\n#x']);
});

test('a list marker being written stays open with the block above until its line is complete', () => {
  const split = splitMarkdownBlocks('1. one\n\n1');
  assert.equal(split.settled, 0);
  assert.deepEqual(splitMarkdownBlocks('1. one\n\n10. ten', split).blocks, ['1. one\n\n10. ten']);
});

test('a block after an indented line is rendered with it', () => {
  const { blocks } = splitMarkdownBlocks('    indented code\n\n2. two\n\nnext');
  assert.equal(blocks[0], '    indented code\n\n2. two\n\n');
});

test('link reference definitions and footnotes keep the text in one block', () => {
  for (const text of ['See [the report][r].\n\nMore text.\n\n[r]: https://example.com', 'A claim.[^1]\n\nMore text.\n\n[^1]: The source.']) {
    assert.deepEqual(splitMarkdownBlocks(text).blocks, [text]);
  }
});

test('a definition in a quote, a list item or with an unusual label keeps the text in one block, at every streamed length', () => {
  for (const [definition, use] of DEFINITIONS) {
    for (const text of [`See ${use}.\n\nMore text.\n\n${definition}\n\nAfter.`, `${definition}\n\nIntro.\n\nSee ${use}.\n\nAfter.`]) {
      let previous: MarkdownBlocks | null = null;
      for (const prefix of prefixes(text)) {
        const carried: MarkdownBlocks = splitMarkdownBlocks(prefix, previous);
        assert.deepEqual(carried, splitMarkdownBlocks(prefix), prefix);
        assert.equal(normalized(renderBlocks(carried.blocks)), normalized(render(prefix)), prefix);
        previous = carried;
      }
      assert.deepEqual(splitMarkdownBlocks(text).blocks, [text], text);
    }
  }
});

test('text that only looks like a definition keeps the split', () => {
  assert.ok(splitMarkdownBlocks(LOOKALIKES).blocks.length >= 4);
});

test('a text that does not extend the previous one is split from the start', () => {
  const previous = splitMarkdownBlocks('# Title\n\nFirst paragraph.\n\nSecond');
  const rewritten = '# Other\n\nFirst paragraph.\n\nSecond, longer';
  assert.deepEqual(splitMarkdownBlocks(rewritten, previous).blocks, splitMarkdownBlocks(rewritten).blocks);
});

test('the splitter returns the same blocks for the same text and follows a growing one', () => {
  const splitter = new MarkdownBlockSplitter();
  const first = splitter.split('# Title\n\nBody');
  assert.equal(splitter.split('# Title\n\nBody'), first);
  assert.deepEqual(splitter.split('# Title\n\nBody text\n\nNext'), ['# Title\n\n', 'Body text\n\n', 'Next']);
  assert.deepEqual(splitter.split(''), []);
});
