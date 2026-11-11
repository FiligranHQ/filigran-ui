/**
 * Rendering tests of the panel's tooltip, drawn as the design system's - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { Tooltip } = await import('./Tooltip.tsx');
const { TOOLTIP_OPEN_DELAY_MS } = await import('../utils/tooltipPlacement.ts');

async function render(node: React.ReactNode) {
  const panel = document.createElement('div');
  panel.className = 'filigran-chatbot';
  document.body.appendChild(panel);
  const root = createRoot(panel);
  await act(async () => {
    root.render(node);
    await settle();
  });
  return panel;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function hover(el: Element, ms: number) {
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    await wait(ms);
    await settle();
  });
}

test('a tooltip opens after the design system delay, with its surface, inside the panel', async () => {
  const panel = await render(
    <Tooltip title="New chat">
      <button type="button" aria-label="New chat" />
    </Tooltip>,
  );
  const button = panel.querySelector('button')!;
  await hover(button, 50);
  assert.equal(panel.querySelector('[role="tooltip"]'), null, 'a pointer passing over does not open it');
  await hover(button, TOOLTIP_OPEN_DELAY_MS + 50);
  const tip = panel.querySelector<HTMLElement>('[role="tooltip"]');
  assert.ok(tip, 'it opens once the pointer rests');
  assert.equal(tip.textContent, 'New chat');
  assert.ok(tip.classList.contains('chat-tooltip'), 'the design system surface');
  assert.ok(!/bg-gray-900|text-white/.test(tip.className), 'no local colours');
  assert.ok(Number.parseFloat(tip.style.maxWidth) <= 300, 'the design system width');
});

test('Escape closes an open tooltip', async () => {
  const panel = await render(
    <Tooltip title="Close">
      <button type="button" aria-label="Close" />
    </Tooltip>,
  );
  await hover(panel.querySelector('button')!, TOOLTIP_OPEN_DELAY_MS + 50);
  assert.ok(panel.querySelector('[role="tooltip"]'));
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
  });
  assert.equal(panel.querySelector('[role="tooltip"]'), null);
});

test('forSelector: the tooltip names the one control inside a component, on hover and on keyboard focus only', async () => {
  const panel = await render(
    <Tooltip title="Remove image.png" forSelector="button">
      <span>
        <span data-testid="label">image.png</span>
        <button type="button" aria-label="Remove image.png" />
      </span>
    </Tooltip>,
  );
  await hover(panel.querySelector('[data-testid="label"]')!, TOOLTIP_OPEN_DELAY_MS + 50);
  assert.equal(panel.querySelector('[role="tooltip"]'), null, 'not over the label');
  const button = panel.querySelector('button')!;
  await hover(button, TOOLTIP_OPEN_DELAY_MS + 50);
  assert.equal(panel.querySelector('[role="tooltip"]')?.textContent, 'Remove image.png', 'over the control');
  await hover(panel.querySelector('[data-testid="label"]')!, 10);
  assert.equal(panel.querySelector('[role="tooltip"]'), null, 'back on the label, it closes');
  const matches = button.matches.bind(button);
  button.matches = (selector: string) => selector === ':focus-visible' || matches(selector);
  await act(async () => {
    button.focus();
    await settle();
  });
  assert.equal(panel.querySelector('[role="tooltip"]')?.textContent, 'Remove image.png', 'on keyboard focus');
});

test('no control of the panel uses a native title tooltip', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const ts = (await import('typescript')).default;
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const found: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(dir + file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    // `title` on an intrinsic element (button, span...) is the browser's white bubble;
    // `<Tooltip title=...>` and a component's own `title` prop (a header text) are not.
    const visit = (node: import('typescript').Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText() === 'title') {
        const tag = node.parent.parent.tagName.getText();
        if (/^[a-z]/.test(tag)) found.push(`${file}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} <${tag} title>`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(found, []);
});
