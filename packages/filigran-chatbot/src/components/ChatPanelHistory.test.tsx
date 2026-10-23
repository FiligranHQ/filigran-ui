/**
 * Rendering tests of the history features a host opts into - `yarn test`:
 * older messages from the backend, clearing every conversation, a send held
 * until the turn ends, the backend's voice, jumping to a message, and the
 * skeleton of a conversation being read back.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { fakeBackend, installDom, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';

installDom();
const { ChatPanel } = await import('./ChatPanel.tsx');
type Props = import('../types.ts').ChatPanelProps;
type Handle = import('../types.ts').ChatPanelHandle;

const AGENTS = [{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null }];

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const baseProps: Props = {
  mode: 'inline',
  onClose: () => undefined,
  onModeChange: () => undefined,
  apiBaseUrl: '/api',
  user: { firstName: 'Ada' },
};

async function render(props: Partial<Props>, ref?: React.Ref<Handle>) {
  await act(async () => {
    root.render(<ChatPanel {...baseProps} {...props} ref={ref} />);
  });
  await act(async () => settle());
}

const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);
const restoreRoute =
  (messages: unknown[], extra: Record<string, unknown> = {}) =>
  (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages, ...extra }) : undefined;
const text = () => container.textContent ?? '';
/** Close what a test left open, inside `act`: the panel answers it with updates. */
const finish = (...streams: { close: () => void }[]) =>
  act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });
const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);

test('older messages are fetched from the backend, before the oldest one shown', async () => {
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm3', role: 'assistant', content: 'newest answer' }], { has_more: true }),
    (req) =>
      req.url.startsWith('/api/chat/sessions/c1/messages?')
        ? json({ messages: [{ id: 'm1', role: 'user', content: 'the first question' }], has_more: false })
        : undefined,
  ]);
  await render({ conversationId: 'c1', apiEndpoints: { messagesPage: '/chat/sessions' } });
  assert.ok(!text().includes('the first question'));
  await act(async () => {
    button('Load earlier messages')!.click();
    await settle();
  });
  const page = requests.find((r) => r.url.startsWith('/api/chat/sessions/c1/messages?'))!;
  const params = new URL(page.url, 'http://host.test').searchParams;
  assert.equal(params.get('before'), 'm3');
  assert.equal(params.get('supports_artifacts'), 'true');
  assert.ok(text().includes('the first question'));
  assert.equal(button('Load earlier messages'), undefined, 'nothing older is left');
});

test('without the route, a restore offers nothing older', async () => {
  fakeBackend([agentsRoute, restoreRoute([{ id: 'm3', role: 'assistant', content: 'answer' }], { has_more: true })]);
  await render({ conversationId: 'c1' });
  assert.equal(button('Load earlier messages'), undefined);
});

test('every conversation is cleared after a confirmation', async () => {
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'GET' ? json([{ conversation_id: 'c1', title: 'One' }]) : undefined),
    (req) => (req.url === '/api/chat/sessions' && req.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined),
  ]);
  await render({ apiEndpoints: { clearAll: '/chat/sessions' } });
  await act(async () => button('Clear all conversations')!.click());
  await act(async () => {
    button('Delete all conversations')!.click();
    await settle();
  });
  assert.equal(requests.filter((r) => r.method === 'DELETE' && r.url === '/api/chat/sessions').length, 1);
  assert.ok(!text().includes('One'));
});

test('a steer refused because the turn just ended is held, then sent as the next turn', async () => {
  const first = sseStream();
  const second = sseStream();
  let turns = 0;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      turns += 1;
      return turns === 1 ? first.response() : second.response();
    },
    (req) => (req.url === '/api/chat/messages/steer' ? json({ detail: 'no active run' }, 409) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', holdSendsDuringTurn: true }, ref);
  await act(async () => {
    ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    ref.current!.send('and also this');
    await settle();
  });
  assert.ok(text().includes('Sends when the answer ends:'));
  await act(async () => {
    first.send({ type: 'done', content: 'ok', conversation_id: 'c1' });
    first.close();
    await settle(10);
  });
  const sends = requests.filter((r) => r.url === '/api/chat/messages').map((r) => (r.body as { content: string }).content);
  assert.deepEqual(sends, ['first', 'and also this']);
  await finish(second);
});

test("read aloud uses the backend's voice when the host names its route", async () => {
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm1', role: 'assistant', content: 'Read **this** aloud.' }]),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3'], { type: 'audio/mpeg' })) : undefined),
  ]);
  await render({ conversationId: 'c1', apiEndpoints: { tts: '/chat/tts' } });
  await act(async () => {
    button('Read aloud')!.click();
    await settle();
  });
  assert.deepEqual(requests.find((r) => r.url === '/api/chat/tts')?.body, { text: 'Read this aloud.', format: 'mp3' });
});

test('a long answer is read aloud whole, one bounded request after the other, on one player', async () => {
  const sentence = 'This sentence is part of a very long answer. ';
  const long = sentence.repeat(200).trim();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm1', role: 'assistant', content: long }]),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3'], { type: 'audio/mpeg' })) : undefined),
  ]);
  const original = globalThis.Audio;
  let players = 0;
  // Each clip ends as soon as it plays.
  globalThis.Audio = class {
    constructor() {
      players += 1;
    }
    src = '';
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play() {
      setTimeout(() => this.onended?.(), 0);
      return Promise.resolve();
    }
    pause() {}
  } as unknown as typeof Audio;
  try {
    await render({ conversationId: 'c1', apiEndpoints: { tts: '/chat/tts' } });
    await act(async () => {
      button('Read aloud')!.click();
      await settle(30);
    });
  } finally {
    globalThis.Audio = original;
  }
  const texts = requests.filter((r) => r.url === '/api/chat/tts').map((r) => (r.body as { text: string }).text);
  assert.ok(texts.length > 1);
  assert.equal(players, 1, 'one audio element plays every part');
  assert.ok(texts.every((t) => t.length <= 4096));
  assert.equal(texts.join(' '), long);
});

test('the host jumps to a message by its id', async () => {
  fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'user', content: 'hello' }])]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  assert.equal(ref.current!.scrollToMessage('m1'), true);
  assert.ok(container.querySelector('[data-message-id="m1"]')!.classList.contains('filigran-chat-highlight'));
  assert.equal(ref.current!.scrollToMessage('nope'), false);
});

test('a conversation being read back shows a skeleton, not the welcome screen', async () => {
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? new Promise<Response>(() => undefined) : undefined),
  ]);
  await render({ conversationId: 'c1' });
  assert.ok(container.querySelector('[data-testid="filigran-chat-loading"]'));
  assert.ok(!text().includes('How can'));
});

test('a backend whose turns outlive their stream gets the conversation created before the first message', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c-new', messages: [] }) : undefined),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'ok' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  await act(async () => {
    ref.current!.send('first message');
    await settle();
  });
  const order = requests.filter((r) => r.method === 'POST').map((r) => r.url);
  assert.deepEqual(order.slice(0, 2), ['/api/chat/sessions', '/api/chat/messages']);
  assert.equal((requests.find((r) => r.url === '/api/chat/messages')!.body as { conversation_id: string }).conversation_id, 'c-new');
  await act(async () => {
    ref.current!.stop();
    await settle();
  });
  // Nothing of the turn came yet: the Stop says it awaits the send.
  assert.deepEqual(requests.find((r) => r.url === '/api/chat/messages/cancel')?.body, { conversation_id: 'c-new', awaiting_send: true });
  stream.send({ type: 'cancelled' });
  await finish(stream);
});
