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

test('every composer control sits in one action row below the text area, so none moves as the text grows', async () => {
  fakeBackend([agentsRoute]);
  await render({ composerToolbar: <button type="button">Host control</button> });
  const field = container.querySelector('[data-testid="filigran-chat-composer-box"]')!;
  const row = container.querySelector('[data-testid="filigran-chat-composer-actions"]')!;
  assert.ok(field && row, 'the field and its action row render');
  assert.equal(row.parentElement, field, 'the action row is inside the field');
  assert.equal(textarea().parentElement, field, 'the text area is inside the field');
  assert.ok(textarea().compareDocumentPosition(row) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'the text area comes first, the row under it');
  assert.ok(!row.contains(textarea()), 'the text area grows on its own, never in the row');
  for (const name of ['Attach files', 'Send']) {
    assert.ok(row.querySelector(`button[aria-label="${name}"]`), `${name} is in the action row`);
  }
  const host = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Host control')!;
  assert.ok(row.contains(host), 'host controls join the same row, never a second row outside the field');
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

test('Enter while an input method composes leaves the mention menu alone', async () => {
  fakeBackend([agentsRoute]);
  await render({ agentMentions: true });
  // Typed in the focused field, the caret after `@`: the menu reads the caret.
  await act(async () => {
    textarea().focus();
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea()), 'value')?.set?.call(textarea(), '@');
    textarea().setSelectionRange(1, 1);
    textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
    textarea().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
  });
  assert.ok(container.querySelector('[role="listbox"] [role="option"]'), 'the mention menu is open');
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }) as unknown as Event;
  assert.equal(await fire(textarea(), enter, { keyCode: 229 }), false, 'the composition takes Enter');
  assert.equal(textarea().value, '@', 'no agent is inserted into the unfinished word');
});

test('a draft mentioning an agent not meant for chat warns of it until the mention is removed', async () => {
  fakeBackend([
    (req) =>
      req.url === '/api/chat/agents'
        ? json([
            { id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null },
            { id: 'a2', name: 'Reporter', slug: 'reporter', icon: null, description: null, disable_chat: true },
          ])
        : undefined,
  ]);
  await render({ agentMentions: true });
  // A boolean: a failed assertion on a DOM node takes minutes to print.
  const warning = () => !!container.querySelector('[data-testid="filigran-chat-agent-not-for-chat"]');
  const type = async (value: string) =>
    act(async () => {
      textarea().focus();
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea()), 'value')?.set?.call(textarea(), value);
      textarea().setSelectionRange(value.length, value.length);
      textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
      textarea().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await settle();
    });
  await type('@Rep');
  const option = [...container.querySelectorAll('[role="listbox"] [role="option"]')].find((o) => o.textContent?.includes('Reporter'));
  assert.ok(option, 'the mention menu offers Reporter');
  await fire(option, new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }) as unknown as Event);
  assert.ok(textarea().value.startsWith('@'), textarea().value);
  assert.ok(warning(), 'the mentioned agent is warned of, the conversation being with Hunter');
  await type('no mention left');
  assert.equal(warning(), false, 'the mention removed, the warning goes');
});

/** Drag *types* over *target* (`dragover`, then `drop`): whether each was cancelled, and the drop effect asked for. */
async function dragOnto(target: Element, types: string[]) {
  const dataTransfer = { types, files: [] as File[], dropEffect: 'move' };
  const over = await fire(target, new window.Event('dragover', { bubbles: true, cancelable: true }) as unknown as Event, { dataTransfer });
  const dropEffect = dataTransfer.dropEffect;
  const drop = await fire(target, new window.Event('drop', { bubbles: true, cancelable: true }) as unknown as Event, { dataTransfer });
  return { over, drop, dropEffect };
}

const header = () => container.querySelector('[data-testid="filigran-chat-panel"]')!.firstElementChild!;

test('a file dropped on a read-only panel leaves the page where it is', async () => {
  fakeBackend([agentsRoute]);
  await render({ readOnly: true, readOnlyNotice: <span data-testid="notice">Read only</span> });
  const notice = container.querySelector('[data-testid="notice"]')!;
  assert.deepEqual(await dragOnto(notice, ['Files']), { over: true, drop: true, dropEffect: 'move' }, 'the browser does not open it');
  assert.deepEqual(
    await dragOnto(notice, ['text/plain']),
    { over: false, drop: false, dropEffect: 'move' },
    'a dragged selection is left to the page',
  );
});

test('a file dropped on a panel that takes no files leaves the page where it is', async () => {
  fakeBackend([agentsRoute]);
  await render({ disableFileManagement: true });
  assert.deepEqual(await dragOnto(textarea(), ['Files']), { over: true, drop: true, dropEffect: 'move' });
});

test('a picture or link dragged from a page goes into a text field as its address, on a panel that takes no files', async () => {
  fakeBackend([agentsRoute]);
  await render({ disableFileManagement: true });
  const picture = ['Files', 'text/uri-list', 'text/html'];
  assert.deepEqual(await dragOnto(textarea(), picture), { over: false, drop: false, dropEffect: 'move' }, 'the composer takes its address');
  assert.deepEqual(await dragOnto(header(), picture), { over: true, drop: true, dropEffect: 'move' }, 'elsewhere it is not opened');
});

test("a host's drop zone around the panel still gets a file dropped on it", async () => {
  fakeBackend([agentsRoute]);
  await render({ readOnly: true });
  const dropped: string[] = [];
  const hostOver = (e: Event) => e.preventDefault();
  const hostDrop = (e: Event) => {
    e.preventDefault();
    dropped.push((e as DragEvent).dataTransfer!.dropEffect);
  };
  container.addEventListener('dragover', hostOver);
  container.addEventListener('drop', hostDrop);
  try {
    const dataTransfer = { types: ['Files'], files: [] as File[], dropEffect: 'copy' };
    await fire(header(), new window.Event('dragover', { bubbles: true, cancelable: true }) as unknown as Event, { dataTransfer });
    await fire(header(), new window.Event('drop', { bubbles: true, cancelable: true }) as unknown as Event, { dataTransfer });
    assert.deepEqual(dropped, ['copy'], 'the drop effect the host chose stands');
  } finally {
    container.removeEventListener('dragover', hostOver);
    container.removeEventListener('drop', hostDrop);
  }
});

test('a file dropped outside the thread leaves the page where it is; the thread still takes it', async () => {
  const requests = fakeBackend([agentsRoute]);
  await render({});
  assert.deepEqual(await dragOnto(header(), ['Files']), { over: true, drop: true, dropEffect: 'move' }, 'the header');
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0, 'nothing is attached from the header');
  const { over, dropEffect } = await dragOnto(textarea(), ['Files']);
  assert.deepEqual({ over, dropEffect }, { over: true, dropEffect: 'copy' }, 'the thread offers to attach it');
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

test('two panels on one conversation keep the draft typed in either: the other does not write over it', async () => {
  fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({}, ref);
  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  const other = createRoot(otherContainer);
  await act(async () => {
    other.render(<ChatPanel mode="inline" apiBaseUrl="/api" user={{ firstName: 'Ada' }} />);
    await settle();
  });
  try {
    await act(async () => ref.current!.setDraft('typed in the first'));
    await fire(window as unknown as EventTarget, new window.Event('pagehide') as unknown as Event);
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'typed in the first');
  } finally {
    await act(async () => other.unmount());
    otherContainer.remove();
  }
});

test('the draft is written under the storage prefix the panel has when the page goes away', async () => {
  fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({ storageKeyPrefix: 'before' }, ref);
  await render({ storageKeyPrefix: 'after' }, ref);
  await act(async () => ref.current!.setDraft('a draft'));
  await fire(window as unknown as EventTarget, new window.Event('pagehide') as unknown as Event);
  assert.equal(sessionStorage.getItem(`after:${DRAFT_KEY}`), 'a draft');
  assert.equal(sessionStorage.getItem(`before:${DRAFT_KEY}`), null);
});
