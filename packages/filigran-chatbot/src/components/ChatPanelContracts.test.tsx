/**
 * Rendering tests of what the panel promises every host - `yarn test`: a plain
 * host sees the panel it always had, the panel's own fields stay its own, the
 * handle and its outcomes, and turns that outlive their stream.
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

const baseProps: Props = { mode: 'inline', apiBaseUrl: '/api', user: { firstName: 'Ada' } };

async function render(props: Partial<Props>, ref?: React.Ref<Handle>) {
  await act(async () => {
    root.render(<ChatPanel {...baseProps} {...props} ref={ref} />);
  });
  await act(async () => settle());
}

const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);
const restoreRoute =
  (messages: unknown[] = []) =>
  (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages }) : undefined;
const messages = (requests: RecordedRequest[]) => requests.filter((r) => r.url === '/api/chat/messages');
const text = () => container.textContent ?? '';
/** Close what a test left open, inside `act`: the panel answers it with updates. */
const finish = (...streams: { close: () => void }[]) =>
  act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });

test('a plain host streams, fails and stops as it always did, naming no client', async () => {
  const first = sseStream();
  const second = sseStream();
  let turns = 0;
  const requests = fakeBackend([
    agentsRoute,
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      turns += 1;
      return turns === 1 ? first.response() : second.response();
    },
  ]);
  const ref = createRef<Handle>();
  await render({ mode: 'sidebar', onClose: () => undefined, onModeChange: () => undefined }, ref);
  await act(async () => {
    void ref.current!.send('hello');
    await settle();
    first.send({ type: 'status', status: 'tool_start', tools: ['search'] });
    first.send({ type: 'stream', content: 'Hi there' });
    first.send({ type: 'done', content: 'Hi there', conversation_id: 'c1' });
    first.close();
    await settle(10);
  });
  assert.ok(text().includes('Hi there'));
  await act(async () => {
    void ref.current!.send('again');
    await settle();
    second.send({ type: 'error', content: 'The model is unavailable.' });
    second.close();
    await settle(10);
  });
  assert.ok(text().includes('The model is unavailable.'));
  assert.equal(messages(requests).length, 2);
  assert.ok(
    messages(requests).every((r) => !('x-chat-client-id' in r.headers)),
    'no client id without an event stream',
  );
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 0);
  assert.ok(container.querySelector('button[aria-label]'), 'its header controls are there');
});

test("the host's extras never stand in for the panel's own fields", async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render(
    { getRequestExtras: () => ({ content: 'forged', agent_slug: 'other', file_ids: ['f9'], mentioned_agent_ids: ['a9'], mode: 'deep' }) },
    ref,
  );
  await act(async () => {
    void ref.current!.send('genuine', { extras: { conversation_id: 'c9' } });
    await settle();
  });
  const body = messages(requests)[0].body as Record<string, unknown>;
  assert.equal(body.content, 'genuine');
  assert.equal(body.agent_slug, 'hunter');
  assert.notEqual(body.conversation_id, 'c9');
  assert.equal(body.file_ids, undefined);
  assert.equal(body.mentioned_agent_ids, undefined);
  assert.equal(body.mode, 'deep');
  await finish(stream);
});

test('the handle is the same for the panel’s life, and says what became of each send', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  const handle = ref.current;
  await render({ headerActions: <span>rerendered</span> }, ref);
  assert.equal(ref.current, handle);
  // Handle calls run as the panel renders: awaited outside `act`, which flushes them.
  let empty!: Promise<unknown>;
  let started!: Promise<unknown>;
  await act(async () => {
    empty = ref.current!.send('   ');
    started = ref.current!.send('go');
    await settle();
  });
  assert.equal(await empty, 'dropped');
  assert.equal(await started, 'sent', 'resolved as the turn starts, its answer still streaming');
  assert.equal(messages(requests).length, 1);
  await finish(stream);
});

test('a read-only panel sends nothing, from the handle or the suggestions', async () => {
  const requests = fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({ readOnly: true, promptSuggestions: ['Summarize this'] }, ref);
  assert.equal(await ref.current!.send('hello'), 'dropped');
  assert.equal(messages(requests).length, 0);
  assert.ok(![...container.querySelectorAll('button')].some((b) => b.textContent === 'Summarize this'));
});

test('without onClose and onModeChange, a sidebar has no close button and no view switcher', async () => {
  fakeBackend([agentsRoute]);
  await render({ mode: 'sidebar' });
  assert.ok(!container.querySelector('button[aria-label="Close"]'));
  assert.ok(![...container.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === 'Switch view'));
  assert.ok(!text().includes('Switch to'));
});

test('a host that translates names no locale and stays in English', async () => {
  fakeBackend([agentsRoute]);
  Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
  try {
    await render({ t: (key) => key });
    assert.ok(container.querySelector('button[aria-label="Send"]'));
  } finally {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
  }
});

test('Stop gives a held message back to the composer instead of sending it', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ detail: 'no active run' }, 409) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', holdSendsDuringTurn: true }, ref);
  let outcomes!: Promise<unknown[]>;
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    outcomes = Promise.all([ref.current!.send('one more'), ref.current!.send('and another')]);
    await settle(10);
  });
  assert.deepEqual(await outcomes, ['held', 'held']);
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.equal(messages(requests).length, 1, 'the held message is not sent');
  const composer = container.querySelector('textarea')!;
  assert.equal(composer.value, 'one more\n\nand another', 'held messages come back together');
});

test('the event stream waits for the conversation’s own history, and a relayed turn stopped stays stopped', async () => {
  let releaseRestore!: () => void;
  const restored = new Promise<void>((resolve) => (releaseRestore = resolve));
  const events = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      await restored;
      return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'user', content: 'asked earlier' }] });
    },
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  // No cancel route: Stop lets go of the turn on screen at once.
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 0, 'not before the history is on screen');
  await act(async () => {
    releaseRestore();
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 1);
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't1' });
    events.send({ type: 'stream', turn_id: 't1', content: 'relayed' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'stream', turn_id: 't1', content: 'relayed and more' });
    await settle(10);
  });
  assert.ok(!text().includes('relayed and more'), 'a stopped turn does not come back');
  await finish(events);
});

test('an own turn whose stream drops is picked up from the event stream, under a new client id', async () => {
  const stream = sseStream();
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => {
      if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
      const events = sseStream();
      subscriptions.push(events);
      return events.response();
    },
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    void ref.current!.send('long task');
    await settle();
    stream.send({ type: 'turn_started', turn_id: 't1' });
    stream.send({ type: 'stream', turn_id: 't1', content: 'Working' });
    await settle(10);
  });
  await act(async () => {
    stream.fail();
    await settle(10);
  });
  assert.ok(!text().includes('Sorry, an error occurred'), 'no error for a turn still running');
  const ids = requests.filter((r) => r.url.includes('/events')).map((r) => r.headers['x-chat-client-id']);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  await act(async () => {
    const live = subscriptions[subscriptions.length - 1];
    live.send({ type: 'thinking', turn_id: 't1', resumed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Working, and done' });
    live.send({ type: 'done', turn_id: 't1', content: 'Working, and done', message_id: 'm2' });
    await settle(10);
  });
  assert.ok(text().includes('Working, and done'));
  await finish(...subscriptions);
});

test('Continue now ends an announced wait', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/skip-wait' ? json({ status: 'ok' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { skipWait: '/chat/messages/skip-wait' } }, ref);
  await act(async () => {
    void ref.current!.send('wait for it');
    await settle();
    stream.send({ type: 'status', status: 'wait_start', seconds: 60, reason: 'rate limit' });
    await settle(10);
  });
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Continue now');
  assert.ok(button);
  await act(async () => {
    button.click();
    await settle();
  });
  const skip = requests.find((r) => r.url === '/api/chat/messages/skip-wait');
  assert.deepEqual(skip?.body, { conversation_id: 'c1' });
  assert.ok(![...container.querySelectorAll('button')].some((b) => b.textContent === 'Continue now'));
  await finish(stream);
});
