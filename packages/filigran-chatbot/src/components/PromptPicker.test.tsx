/**
 * Rendering tests of the composer's prompt template button - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { PromptPicker } = await import('./PromptPicker.tsx');

test('the prompt template button has the size of every other composer action', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PromptPicker prompts={[{ id: 'p1', title: 'Summarise', content: 'Summarise this' }]} onPick={() => {}} t={(s: string) => s} />);
    await settle();
  });
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Insert prompt template"]')!;
  assert.ok(button, 'the button renders');
  // Attach, dictate and send are w-8 h-8 with an 18 px glyph: one control
  // height and one icon size per row (UX round 1 on #516, finding F5).
  const classes = button.className.split(/\s+/);
  assert.ok(classes.includes('w-8') && classes.includes('h-8'), '32 x 32, as the other actions');
  assert.ok(classes.includes('shrink-0'), 'never squeezed by the row');
  assert.equal(button.querySelector('svg')!.getAttribute('width'), '18', 'an 18 px glyph, as the other actions');
});
