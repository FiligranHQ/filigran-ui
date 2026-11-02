/**
 * Rendering tests of the composer's basics - `yarn test`: what a paste
 * attaches, Enter during an input method's composition, a file dropped on a
 * read-only panel, and the draft written before the page goes away.
 *
 * `react-dom` is loaded after the page is installed, not through
 * `test/panel.tsx`: it decides at load which events it listens to, and one
 * loaded before the page hears no keyboard or drag events.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, installDom, json, settle, type RecordedRequest } from '../../test/dom.ts';
import { clipboardOf, PASTE_CASES } from '../../test/clipboard.ts';

installDom();
const { createRoot } = await import('react-dom/client');
const { ChatPanel } = await import('./ChatPanel.tsx');

type Props = import('../types.ts').ChatPanelProps;
type Handle = import('../types.ts').ChatPanelHandle;

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(props: Partial<Props>, ref?: React.Ref<Handle>) {
  await act(async () => {
    root.render(<ChatPanel mode="inline" apiBaseUrl="/api" user={{ firstName: 'Ada' }} {...props} ref={ref} />);
  });
  await act(async () => settle());
}

const agentsRoute = (req: RecordedRequest) =>
  req.url === '/api/chat/agents' ? json([{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null }]) : undefined;
const messages = (requests: RecordedRequest[]) => requests.filter((r) => r.url === '/api/chat/messages');
const textarea = () => container.querySelector('textarea')!;

/** Dispatch *event* on *target*, with *props* set on it; whether it was cancelled. */
async function fire(target: EventTarget, event: Event, props: Record<string, unknown> = {}): Promise<boolean> {
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  await act(async () => {
    target.dispatchEvent(event);
    await settle();
  });
  return event.defaultPrevented;
}

const pasteCase = (name: string) => PASTE_CASES.find((c) => c.name.startsWith(name))!;

test('a paste of office cells reaches the text box; a screenshot is attached', async () => {
  const requests = fakeBackend([agentsRoute]);
  await render({});
  const cells = pasteCase('cells copied in Excel on Windows');
  const paste = () => new window.Event('paste', { bubbles: true, cancelable: true }) as unknown as Event;
  assert.equal(await fire(textarea(), paste(), { clipboardData: clipboardOf(cells) }), false, 'the text is pasted');
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0, 'no picture of the cells is uploaded');
  assert.equal(await fire(textarea(), paste(), { clipboardData: clipboardOf(pasteCase('a screenshot')) }), true, 'the screenshot is taken');
  assert.ok(
    requests.some((r) => r.method === 'POST'),
    'the screenshot is uploaded',
  );
});

test('Enter while an input method composes does not send', async () => {
  const requests = fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => {
    ref.current!.setDraft('日本');
    await settle();
  });
  const enter = (init: Record<string, unknown>) =>
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }) as unknown as Event;
  await fire(textarea(), enter({ isComposing: true }));
  await fire(textarea(), enter({ keyCode: 229 }));
  assert.equal(messages(requests).length, 0, 'the composition is confirmed, not sent');
  assert.equal(textarea().value, '日本');
  await fire(textarea(), enter({ keyCode: 13 }));
  assert.equal(messages(requests).length, 1, 'Enter once the composition ends sends');
});

test('a file dropped on a read-only panel leaves the page where it is', async () => {
  fakeBackend([agentsRoute]);
  await render({ readOnly: true, readOnlyNotice: <span data-testid="notice">Read only</span> });
  const target = container.querySelector('[data-testid="notice"]')!;
  const drag = (type: string, types: string[]) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true }) as unknown as Event;
    return fire(target, event, { dataTransfer: { types, files: [], dropEffect: 'none' } });
  };
  assert.equal(await drag('dragover', ['Files']), true, 'the browser does not offer to open it');
  assert.equal(await drag('drop', ['Files']), true, 'nor opens it');
  assert.equal(await drag('dragover', ['text/plain']), false, 'a dragged selection is left to the page');
  assert.equal(await drag('drop', ['text/plain']), false);
});

const DRAFT_KEY = 'filigranChatDraft:new';

test('the draft is written when the page goes away, before its debounce', async () => {
  fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => ref.current!.setDraft('half a question'));
  assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'still inside the debounce');
  await fire(window as unknown as EventTarget, new window.Event('pagehide') as unknown as Event);
  assert.equal(sessionStorage.getItem(DRAFT_KEY), 'half a question');
});

test('the draft is written when the page is hidden, and not when it shows again', async () => {
  fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({}, ref);
  const visibility = (state: string) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    return fire(document as unknown as EventTarget, new window.Event('visibilitychange') as unknown as Event);
  };
  try {
    await act(async () => ref.current!.setDraft('a draft'));
    await visibility('visible');
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'a page shown again writes nothing');
    await visibility('hidden');
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'a draft');
  } finally {
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});
