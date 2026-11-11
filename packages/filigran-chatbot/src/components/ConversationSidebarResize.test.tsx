/**
 * The conversation list's width - `yarn test`: dragged from its right edge
 * between its bounds, remembered across mounts, reset by a double-click, moved
 * by the keyboard, and kept while the list is collapsed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
const { createRoot } = await import('react-dom/client');
const { ConversationSidebar, LIST_WIDTH, clampListWidth } = await import('./ConversationSidebar.tsx');
const { STORAGE_KEYS } = await import('../utils/storage.ts');

const KEY = STORAGE_KEYS.conversationListWidth;

async function mount(collapsed = false, panelWidth: number | null = null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const draw = (isCollapsed: boolean) =>
    act(async () => {
      root.render(
        <ConversationSidebar
          conversations={[{ conversationId: 'c1', title: 'A conversation with a rather long title' }]}
          loading={false}
          activeConversationId={null}
          collapsed={isCollapsed}
          onToggleCollapsed={() => undefined}
          onSelect={() => undefined}
          onDelete={() => undefined}
          onNewChat={() => undefined}
          panelWidth={panelWidth}
          t={(key) => key}
        />,
      );
      await settle();
    });
  await draw(collapsed);
  const list = () => container.firstElementChild as HTMLElement;
  const handle = () => container.querySelector<HTMLElement>('[role="separator"]');
  const unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, list, handle, draw, unmount };
}

function fire(target: HTMLElement, type: string, init: Record<string, unknown>) {
  const Ctor = type.startsWith('pointer') ? (window.PointerEvent ?? window.MouseEvent) : type.startsWith('key') ? window.KeyboardEvent : window.MouseEvent;
  target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, ...init }) as unknown as Event);
}

test('the list keeps the width it always had until the user resizes it', async () => {
  localStorage.removeItem(KEY);
  const { list, handle, unmount } = await mount();
  assert.equal(list().style.width, `${LIST_WIDTH.default}px`);
  const edge = handle()!;
  assert.equal(edge.getAttribute('aria-orientation'), 'vertical');
  assert.equal(edge.getAttribute('aria-label'), 'Resize the conversation list');
  assert.equal(edge.getAttribute('aria-valuenow'), String(LIST_WIDTH.default));
  await unmount();
});

test('a drag on the edge resizes the list within its bounds and the width survives a reload', async () => {
  localStorage.removeItem(KEY);
  const first = await mount();
  const edge = first.handle()!;
  await act(async () => {
    fire(edge, 'pointerdown', { button: 0, clientX: 256, pointerId: 1 });
    fire(edge, 'pointermove', { clientX: 316, pointerId: 1 });
    await settle();
  });
  assert.equal(first.list().style.width, `${LIST_WIDTH.default + 60}px`, 'follows the pointer');
  await act(async () => {
    fire(edge, 'pointermove', { clientX: 2000, pointerId: 1 });
    await settle();
  });
  assert.equal(first.list().style.width, `${LIST_WIDTH.max}px`, 'stops at the maximum');
  await act(async () => {
    fire(edge, 'pointermove', { clientX: -500, pointerId: 1 });
    fire(edge, 'pointerup', { clientX: -500, pointerId: 1 });
    await settle();
  });
  assert.equal(first.list().style.width, `${LIST_WIDTH.min}px`, 'stops at the minimum');
  assert.equal(localStorage.getItem(KEY), String(LIST_WIDTH.min), 'kept at the end of the drag');
  await first.unmount();

  const second = await mount();
  assert.equal(second.list().style.width, `${LIST_WIDTH.min}px`, 'the width comes back after a reload');
  await second.unmount();
});

test('a double-click on the edge puts the default width back and forgets the choice', async () => {
  localStorage.setItem(KEY, '300');
  const { list, handle, unmount } = await mount();
  assert.equal(list().style.width, '300px');
  await act(async () => {
    fire(handle()!, 'dblclick', {});
    await settle();
  });
  assert.equal(list().style.width, `${LIST_WIDTH.default}px`);
  assert.equal(localStorage.getItem(KEY), null);
  await unmount();
});

test('the arrow keys, Home and End move the edge', async () => {
  localStorage.removeItem(KEY);
  const { list, handle, unmount } = await mount();
  const key = (k: string) =>
    act(async () => {
      fire(handle()!, 'keydown', { key: k });
      await settle();
    });
  await key('ArrowRight');
  assert.equal(list().style.width, `${LIST_WIDTH.default + 16}px`);
  await key('ArrowLeft');
  await key('ArrowLeft');
  assert.equal(list().style.width, `${LIST_WIDTH.default - 16}px`);
  await key('End');
  assert.equal(list().style.width, `${LIST_WIDTH.max}px`);
  await key('Home');
  assert.equal(list().style.width, `${LIST_WIDTH.min}px`);
  assert.equal(localStorage.getItem(KEY), String(LIST_WIDTH.min));
  await unmount();
});

test('the list collapses and expands as before, at the width the user chose', async () => {
  localStorage.setItem(KEY, '320');
  const { container, list, handle, draw, unmount } = await mount();
  await draw(true);
  assert.equal(handle(), null, 'the collapsed strip has no edge to drag');
  assert.ok(container.querySelector('[aria-label="Show conversations"]'));
  await draw(false);
  assert.equal(list().style.width, '320px');
  await unmount();
});

test('the panel bounds the list: a quarter of it at most, and the rail when the conversation would fall under 680 px', async () => {
  localStorage.setItem(KEY, '360');
  const narrow = await mount(false, 1280);
  assert.equal(narrow.list().style.width, '320px', 'a quarter of 1280 px');
  assert.equal(narrow.handle()!.getAttribute('aria-valuemax'), '320');
  await narrow.unmount();
  const tight = await mount(false, 880);
  assert.equal(tight.handle(), null, 'no edge to drag on the rail');
  assert.ok(tight.container.querySelector('[data-testid="filigran-chat-list-rail"]'));
  assert.ok(tight.container.querySelector('[aria-label="New conversation"]'));
  await tight.unmount();
  const collapsed = await mount(true, 1920);
  for (const label of ['New conversation', 'Search conversations...', 'Show conversations']) {
    assert.ok(collapsed.container.querySelector(`[aria-label="${label}"]`), label);
  }
  await collapsed.unmount();
  localStorage.removeItem(KEY);
});

test('a stored width out of bounds or unreadable is clamped or ignored', async () => {
  assert.equal(clampListWidth(10), LIST_WIDTH.min);
  assert.equal(clampListWidth(9999), LIST_WIDTH.max);
  localStorage.setItem(KEY, 'wide');
  const garbage = await mount();
  assert.equal(garbage.list().style.width, `${LIST_WIDTH.default}px`);
  await garbage.unmount();
  localStorage.setItem(KEY, '9999');
  const wide = await mount();
  assert.equal(wide.list().style.width, `${LIST_WIDTH.max}px`);
  await wide.unmount();
  localStorage.removeItem(KEY);
});
