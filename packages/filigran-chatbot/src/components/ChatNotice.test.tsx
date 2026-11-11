/**
 * Rendering tests of the panel's one notice component - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ChatNotice } = await import('./ChatNotice.tsx');

async function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await settle();
  });
  return container;
}

test('an error is an alert with its icon, its words and its tone', async () => {
  const container = await render(<ChatNotice tone="error">It failed</ChatNotice>);
  const notice = container.querySelector<HTMLElement>('.filigran-chat-notice')!;
  assert.equal(notice.getAttribute('role'), 'alert');
  assert.equal(notice.dataset.tone, 'error');
  assert.ok(notice.querySelector('svg'), 'an icon leads the words');
  assert.equal(notice.textContent, 'It failed');
  assert.equal(notice.querySelector('button'), null, 'no close button without onDismiss');
});

test('a warning is a status unless told otherwise', async () => {
  const container = await render(<ChatNotice tone="warning">Careful</ChatNotice>);
  assert.equal(container.querySelector('.filigran-chat-notice')!.getAttribute('role'), 'status');
});

test('the close button names itself and closes', async () => {
  let closed = 0;
  const container = await render(
    <ChatNotice tone="warning" onDismiss={() => closed++} dismissLabel="Close">
      Not attached
    </ChatNotice>,
  );
  const button = container.querySelector<HTMLButtonElement>('button')!;
  assert.equal(button.getAttribute('aria-label'), 'Close');
  assert.equal(button.getAttribute('title'), null, "the panel's tooltip, never a native title");
  await act(async () => {
    button.click();
    await settle();
  });
  assert.equal(closed, 1);
});

test('the notice and composer tones come from the theme variables, never a Tailwind red or amber', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('.', import.meta.url));
  for (const file of ['ChatNotice.tsx', 'ChatInput.tsx']) {
    const source = readFileSync(dir + file, 'utf8');
    assert.ok(!/(text|bg|border)-(red|amber)-\d/.test(source), `${file} uses a Tailwind red or amber`);
  }
});

test('no notice of the panel is raw coloured text any more', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('.', import.meta.url));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))) {
    const source = readFileSync(dir + file, 'utf8');
    // A role="alert" line coloured by hand is what ChatNotice replaces.
    for (const line of source.split('\n')) {
      if (line.includes('role="alert"')) assert.ok(!/text-(red|amber)-\d/.test(line), `${file}: ${line.trim()}`);
    }
  }
});
