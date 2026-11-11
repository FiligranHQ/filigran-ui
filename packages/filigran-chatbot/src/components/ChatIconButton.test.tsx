/**
 * The panel's icon-only control is the design system's IconButton with the
 * panel's tooltip - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ChatIconButton } = await import('./ChatIconButton.tsx');
const { CloseIcon, TrashIcon } = await import('./icons/index.tsx');

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

test('an icon-only control is a design-system IconButton: tertiary, 36 px, named, its glyph hidden', async () => {
  let clicks = 0;
  const panel = await render(<ChatIconButton label="Close" icon={<CloseIcon size={20} />} onClick={() => (clicks += 1)} />);
  const button = panel.querySelector('button')!;
  assert.equal(button.getAttribute('aria-label'), 'Close');
  assert.equal(button.getAttribute('type'), 'button');
  const classes = button.className.split(/\s+/);
  for (const name of ['h-9', 'w-9', 'rounded-sm', 'text-icon-highlight', 'focus-visible:ring-2', 'focus-visible:ring-filigran-brand-primary']) {
    assert.ok(classes.includes(name), `${name} in ${button.className}`);
  }
  assert.equal(button.querySelector('span')!.getAttribute('aria-hidden'), 'true');
  await act(async () => {
    button.click();
    await settle();
  });
  assert.equal(clicks, 1);
});

test('a delete in a row is the destructive small IconButton, and a menu toggle says it is pressed', async () => {
  const panel = await render(
    <>
      <ChatIconButton label="Delete conversation" icon={<TrashIcon size={16} />} variant="destructive" size="sm" />
      <ChatIconButton label="Switch view" icon={<CloseIcon size={20} />} active aria-haspopup="menu" aria-expanded />
    </>,
  );
  const [remove, toggle] = [...panel.querySelectorAll('button')];
  assert.ok(remove.className.split(/\s+/).includes('h-6'));
  assert.ok(remove.className.split(/\s+/).includes('text-feedback-error-primary'));
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

test('the header draws no hand-styled icon button: every icon-only control goes through ChatIconButton', () => {
  const source = readFileSync(new URL('./ChatHeader.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /w-8 h-8 flex items-center justify-center/, 'a hand-styled 32 px icon button is left');
  assert.doesNotMatch(source, /<button[^>]*aria-label=/, 'a raw <button> named only by aria-label is an icon-only control');
});
