/**
 * Rendering tests of the answer's Markdown - `yarn test`: tables with a filled
 * header and a scrolling frame, nested and task lists, quotes, footnotes, and
 * fenced code coloured by language with its label and copy button.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
const { createRoot } = await import('react-dom/client');
const { MarkdownMessage } = await import('./MarkdownMessage.tsx');

const MESSAGE = [
  '## Findings',
  '',
  '| Id | Name | Severity | Status | Owner | Updated |',
  '|----|------|----------|--------|-------|---------|',
  '| 1 | Alpha | High | Open | Ana | 2026-11-10 |',
  '| 2 | Beta | Low | Closed | Bo | 2026-11-09 |',
  '| 3 | Gamma | Medium | Open | Cy | 2026-11-08 |',
  '',
  '- level one',
  '  - level two',
  '    1. level three',
  '- [x] done task',
  '- [ ] open task',
  '',
  '> a quoted line',
  '',
  'Run `yarn test` first.[^1]',
  '',
  '```python',
  'def f(x):',
  '    return x + 1  # add',
  '```',
  '',
  '```typescript',
  'const total: number = 2;',
  '```',
  '',
  '```json',
  '{"ok": true}',
  '```',
  '',
  '```bash',
  'echo $HOME',
  '```',
  '',
  '```sql',
  'SELECT id FROM users;',
  '```',
  '',
  '[^1]: The footnote.',
].join('\n');

async function render(content: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MarkdownMessage content={content} />);
    await settle();
  });
  return container;
}

test('a table has a filled header row, readable cells and a frame that scrolls sideways', async () => {
  const container = await render(MESSAGE);
  const table = container.querySelector('table');
  assert.ok(table);
  assert.match(table.className, /chat-answer-text/);
  assert.doesNotMatch(table.className, /text-xs/);
  assert.match(table.parentElement!.className, /overflow-x-auto/);
  assert.match(container.querySelector('thead')!.className, /chat-table-head/);
  assert.equal(container.querySelectorAll('th').length, 6);
  assert.equal(container.querySelectorAll('tbody tr').length, 3);
  assert.match(container.querySelector('td')!.className, /min-w-/);
});

test('nested lists, task lists, quotes and footnotes render', async () => {
  const container = await render(MESSAGE);
  assert.ok(container.querySelector('ul ul'));
  assert.ok(container.querySelector('ul ul ol'));
  const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  assert.deepEqual(
    boxes.map((box) => box.checked),
    [true, false],
  );
  assert.ok(boxes.every((box) => box.disabled));
  assert.ok(container.querySelector('blockquote'));
  assert.ok(container.querySelector('section.footnotes, section [id*="fn"]') || container.querySelector('sup a'));
});

test('a task list under a list item has no bullet and the indent of its sibling nested lists', async () => {
  const container = await render(['- Level one', '  - Level two', '- Task list:', '  - [x] Indicators reviewed', '  - [ ] Rule deployed'].join('\n'));
  const outer = container.querySelector('ul')!;
  const nested = [...outer.querySelectorAll<HTMLUListElement>(':scope > li > ul')];
  assert.equal(nested.length, 2);
  const [bullets, tasks] = nested;
  assert.ok(!bullets.classList.contains('contains-task-list'));
  // The class the parent's override selects on stays on the task list.
  assert.ok(tasks.classList.contains('contains-task-list'));
  assert.ok(tasks.querySelectorAll('input[type="checkbox"]').length === 2);
  // The parent overrides its own circle for a task list, at the sibling indent.
  const parent = outer.className.split(/\s+/);
  assert.ok(parent.includes('[&_ul]:list-[circle]'));
  assert.ok(parent.includes('[&_ul.contains-task-list]:list-none'));
  assert.ok(parent.includes('[&_ul.contains-task-list]:pl-5'));
});

test('every fenced block is coloured, labelled by its language and has a copy button', async () => {
  const container = await render(MESSAGE);
  const blocks = [...container.querySelectorAll<HTMLElement>('code[data-language]')];
  assert.deepEqual(
    blocks.map((code) => code.dataset.language),
    ['python', 'typescript', 'json', 'bash', 'sql'],
  );
  for (const code of blocks) {
    assert.ok(code.querySelector('[class^="chat-hl-"]'), `${code.dataset.language} has no coloured token`);
    const frame = code.closest('.chat-code-block')!;
    assert.equal(frame.querySelector('span.font-mono')!.textContent, code.dataset.language);
    assert.ok(frame.querySelector('button[aria-label="Copy code"]'));
  }
  const python = blocks[0];
  assert.equal(python.textContent, 'def f(x):\n    return x + 1  # add');
  assert.equal(python.querySelector('.chat-hl-keyword')!.textContent, 'def');
  assert.equal(python.querySelector('.chat-hl-comment')!.textContent, '# add');
});

test('inline code stays inline and uncoloured', async () => {
  const container = await render('Run `yarn test` first.');
  const code = container.querySelector('code')!;
  assert.match(code.className, /chat-code-inline/);
  assert.equal(code.querySelector('[class^="chat-hl-"]'), null);
});
