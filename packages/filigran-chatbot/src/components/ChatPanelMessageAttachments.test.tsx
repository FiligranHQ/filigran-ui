/**
 * A user's files inside the message bubble - `yarn test`: one message, one
 * bubble with its pictures as thumbnails above the text, several pictures in
 * one row of four with "+N", other files as chips, and a lightbox that walks
 * the message's pictures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { fakeBackend, settle } from '../../test/dom.ts';
import { agentsRoute, BASE_PROPS, container, mountPanels, restoreRoute } from '../../test/panel.tsx';

const { render } = mountPanels({ ...BASE_PROPS, onClose: () => undefined, onModeChange: () => undefined });

const pictures = (n: number) => Array.from({ length: n }, (_, i) => ({ file_id: `p${i}`, filename: `shot-${i}.png`, content_type: 'image/png' }));

const backend = (attachments: object[]) =>
  fakeBackend([
    agentsRoute,
    restoreRoute([
      { id: 'm1', role: 'user', content: 'look at these', attachments },
      { id: 'm2', role: 'assistant', content: 'Seen.' },
    ]),
    (req) => (req.url.startsWith('/api/chat/files/') ? new Response(new Blob(['png'], { type: 'image/png' })) : undefined),
  ]);

const bubble = () => container.querySelector<HTMLElement>('[data-testid="filigran-chat-user-bubble"]')!;

test('a picture sits inside the bubble, above the text, as one compact thumbnail', async () => {
  backend([...pictures(1), { file_id: 'd1', filename: 'report.pdf', content_type: 'application/pdf', type: 'pdf', size: 2048 }]);
  await render({ conversationId: 'c1' });
  assert.ok(bubble(), 'one bubble');
  const files = bubble().querySelector('[data-testid="filigran-chat-message-attachments"]');
  assert.ok(files, 'the files are inside the bubble');
  const text = bubble().querySelector('[data-testid="filigran-chat-user-message"]')!;
  assert.equal(text.textContent, 'look at these');
  assert.ok(files.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING, 'the files come before the text');
  const img = bubble().querySelector('img[alt="shot-0.png"]')!;
  assert.ok(img.className.includes('object-contain'), 'aspect ratio kept');
  const frame = img.closest('button')!;
  assert.equal(frame.style.width, '280px', 'the frame is the 16:9 box at the full width');
  assert.equal(frame.style.height, '158px');
  assert.equal(img.getAttribute('loading'), 'lazy');
  assert.ok(bubble().textContent?.includes('report.pdf'), 'the PDF is a chip in the bubble');
  assert.ok(bubble().textContent?.includes('PDF · 2'), 'with its type and size');
  assert.equal(container.querySelectorAll('[data-testid="filigran-chat-user-bubble"]').length, 1, 'nothing outside the bubble');
});

test('a single picture holds its final box while it loads: the bubble does not move when it arrives', async () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  fakeBackend([
    agentsRoute,
    // A file this page has not drawn yet: an earlier test's picture is served from its cache.
    restoreRoute([{ id: 'm1', role: 'user', content: 'one picture', attachments: [{ file_id: 'held', filename: 'held.png', content_type: 'image/png' }] }]),
    (req) =>
      req.url.startsWith('/api/chat/files/') ? held.then(() => new Response(new Blob(['png'], { type: 'image/png' }))) : undefined,
  ]);
  // With request headers the picture is fetched by the panel, so its bytes can be held.
  await render({ conversationId: 'c1', requestHeaders: { Authorization: 'Bearer t' } });
  const placeholder = bubble().querySelector<HTMLElement>('[data-testid="filigran-chat-picture-placeholder"]')!;
  assert.ok(placeholder, 'a placeholder while the bytes are held');
  const before = { width: placeholder.style.width, height: placeholder.style.height };
  assert.deepEqual(before, { width: '280px', height: '158px' });
  await act(async () => {
    release();
    await settle();
  });
  const frame = bubble().querySelector<HTMLElement>('button[data-ds-exempt="attachment-thumbnail"]')!;
  assert.deepEqual({ width: frame.style.width, height: frame.style.height }, before, 'same box, same border: no jump');
});

test('twelve pictures show one row of four, the fourth reading +9, and the lightbox walks all twelve', async () => {
  backend(pictures(12));
  await render({ conversationId: 'c1' });
  const tiles = bubble().querySelectorAll('button[data-ds-exempt="attachment-thumbnail"]');
  assert.equal(tiles.length, 4);
  assert.equal(tiles[3].textContent?.trim(), '+9');
  assert.equal(tiles[3].getAttribute('aria-label'), 'shot-3.png and 8 more pictures', 'the count is announced, not only drawn');
  assert.equal(tiles[3].querySelector('[aria-hidden="true"]')?.className.includes('text-content-base'), true, 'the +N label uses the DS type scale');
  assert.equal(tiles[0].getAttribute('aria-label'), null, 'a plain tile is named by its picture');
  await act(async () => {
    (tiles[0] as HTMLElement).click();
    await settle();
  });
  const dialog = () => container.querySelector('[role="dialog"]')!;
  assert.equal(dialog().getAttribute('aria-label'), 'shot-0.png');
  assert.ok(dialog().textContent?.includes('1 / 12'));
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await settle();
  });
  assert.equal(dialog().getAttribute('aria-label'), 'shot-11.png', 'Left from the first goes to the last');
  await act(async () => {
    (dialog().querySelector('button[aria-label="Next image"]') as HTMLElement).click();
    await settle();
  });
  assert.equal(dialog().getAttribute('aria-label'), 'shot-0.png');
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
  });
  assert.equal(container.querySelector('[role="dialog"]'), null, 'Escape closes it');
});

test('five pictures: the fourth tile reads +2 and announces one more picture', async () => {
  backend(pictures(5));
  await render({ conversationId: 'c1' });
  const tiles = bubble().querySelectorAll('button[data-ds-exempt="attachment-thumbnail"]');
  assert.equal(tiles.length, 4);
  assert.equal(tiles[3].textContent?.trim(), '+2');
  assert.equal(tiles[3].getAttribute('aria-label'), 'shot-3.png and one more picture');
});

test('three pictures are three equal tiles in one row, with no +N', async () => {
  backend(pictures(3));
  await render({ conversationId: 'c1' });
  assert.ok(bubble());
  const tiles = [...bubble().querySelectorAll('button[data-ds-exempt="attachment-thumbnail"]')];
  assert.equal(tiles.length, 3);
  assert.ok(tiles.every((t) => !t.textContent?.includes('+')));
});
