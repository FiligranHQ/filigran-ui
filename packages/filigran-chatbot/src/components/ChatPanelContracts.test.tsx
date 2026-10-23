/**
 * Rendering tests of what the panel promises every host - `yarn test`: a plain
 * host sees the default panel, the panel's own fields stay its own, the
 * handle and its outcomes, and turns that outlive their stream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import { AGENTS, agentsRoute, container, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';

const { render, unmount } = mountPanels();

const messages = (requests: RecordedRequest[]) => requests.filter((r) => r.url === '/api/chat/messages');

test('a plain host streams, fails and stops, naming no client', async () => {
  const streams = [sseStream(), sseStream(), sseStream()];
  let turns = 0;
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? streams[turns++].response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ mode: 'sidebar', onClose: () => undefined, onModeChange: () => undefined }, ref);
  assert.ok(container.querySelector('button[aria-label="Close"]'), 'its close button');
  assert.ok(container.querySelector('button[aria-label="Switch view"]'), 'its view switcher');
  await act(async () => {
    void ref.current!.send('hello');
    await settle();
    streams[0].send({ type: 'status', status: 'tool_start', tools: ['search'] });
    streams[0].send({ type: 'stream', content: 'Hi there' });
    streams[0].send({ type: 'done', content: 'Hi there', conversation_id: 'c1' });
    streams[0].close();
    await settle(10);
  });
  assert.ok(text().includes('Hi there'));
  // A failure after some text: the backend's words stay, not the text before them.
  await act(async () => {
    void ref.current!.send('again');
    await settle();
    streams[1].send({ type: 'stream', content: 'Half an answer' });
    await settle(10);
    streams[1].send({ type: 'error', content: 'The model is unavailable.' });
    streams[1].close();
    await settle(10);
  });
  assert.ok(text().includes('The model is unavailable.'));
  // Stop lets go of the stream, with no route of its own to call.
  await act(async () => {
    void ref.current!.send('a third');
    await settle();
    streams[2].send({ type: 'stream', content: 'Partly written' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.ok(text().includes('Partly written'));
  assert.ok(text().includes('Stopped'));
  assert.ok(!container.querySelector('button[aria-label="Stop generating"]'));
  assert.equal(messages(requests).length, 3);
  assert.equal(requests.filter((r) => r.url.includes('/cancel') || r.url.includes('/events')).length, 0);
  assert.ok(
    messages(requests).every((r) => !('x-chat-client-id' in r.headers)),
    'no client id without an event stream',
  );
  await finish(...streams);
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
  await render({ mode: 'sidebar', onClose: () => undefined });
  assert.ok(container.querySelector('button[aria-label="Close"]'), 'the close button comes with onClose');
  assert.equal(container.querySelector('button[aria-label="Switch view"]'), null);
  await render({ mode: 'sidebar', onModeChange: () => undefined });
  assert.equal(container.querySelector('button[aria-label="Close"]'), null);
  assert.ok(container.querySelector('button[aria-label="Switch view"]'), 'the view switcher comes with onModeChange');
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

/** Put *value* in the composer and press its button for a send during the turn. */
async function typeAndHold(ref: React.RefObject<Handle | null>, value: string) {
  await act(async () => {
    ref.current!.setDraft(value);
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send when the answer ends"]')?.click();
    await settle(10);
  });
}

test('Stop gives back what the user typed for a held message, and nothing a host sent', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', holdSendsDuringTurn: true, apiEndpoints: { steer: null } }, ref);
  let hostOutcome!: Promise<unknown>;
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle();
  });
  // No steer route: what is sent during the turn waits for it to end.
  // One message waits at a time from the composer; the host's send joins it.
  await typeAndHold(ref, 'one more');
  assert.ok(text().includes('Sends when the answer ends:'));
  await act(async () => {
    hostOutcome = ref.current!.send('from the host');
    await settle(10);
  });
  assert.equal(await hostOutcome, 'held');
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.equal(messages(requests).length, 1, 'the held message is not sent');
  assert.equal(container.querySelector('textarea')!.value, 'one more', "the typed message comes back, the host's does not");
  await finish(stream);
});

test('a held message shows the words its bubble will show; one only a host sent goes nowhere on Stop', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const settled: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { steer: null },
      onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`),
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle();
  });
  let outcome!: Promise<unknown>;
  await act(async () => {
    outcome = ref.current!.send('Summarize report 42 for the analyst on duty', { displayText: 'Summarize the report' });
    await settle(10);
  });
  assert.equal(await outcome, 'held');
  assert.ok(text().includes('Sends when the answer ends:Summarize the report'), text());
  assert.ok(!text().includes('analyst on duty'));
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.equal(messages(requests).length, 1);
  assert.equal(container.querySelector('textarea')!.value, '');
  assert.deepEqual(settled, ['Summarize report 42 for the analyst on duty:dropped'], 'nothing came back to the composer');
  await finish(stream);
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

test('a remembered conversation with no agent to restore it in leaves the panel ready, its id kept', async () => {
  for (const agents of [() => json({ detail: 'down' }, 500), () => json([])]) {
    localStorage.setItem('filigranChatConversationId', 'c1');
    const requests = fakeBackend([
      (req) => (req.url === '/api/chat/agents' ? agents() : undefined),
      (req) => (req.url === '/api/chat/messages' ? sseStream().response() : undefined),
    ]);
    const ref = createRef<Handle>();
    let ready = 0;
    await render({ onReady: () => (ready += 1) }, ref);
    assert.equal(ready, 1, 'the host is told the panel is ready');
    assert.equal(container.querySelector('[data-testid="filigran-chat-loading"]'), null);
    assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 0, 'nothing restored without its agent');
    assert.equal(localStorage.getItem('filigranChatConversationId'), 'c1');
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = ref.current!.send('hello');
      await settle(10);
    });
    assert.equal(await outcome, 'sent', 'the handle does not hang');
    await unmount();
  }
});

test('a backend that is down keeps the conversation; one that refuses the id resets it', async () => {
  for (const [answer, expected] of [
    [() => json({ detail: 'bad gateway' }, 502), []],
    [
      () => {
        throw new TypeError('network error');
      },
      [],
    ],
    [() => json({ detail: 'not found' }, 404), [null]],
    [() => json({ detail: 'crashed on this id' }, 500), [null]],
  ] as const) {
    fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? answer() : undefined)]);
    const changes: (string | null)[] = [];
    await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) });
    assert.deepEqual(changes, expected);
    await unmount();
  }
});

test('Stop while a dropped turn is awaited sticks: its replay is not shown', async () => {
  const stream = sseStream();
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  fakeBackend([
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
  assert.ok(container.querySelector('button[aria-label="Stop generating"]'), 'the turn is still running');
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    const live = subscriptions[subscriptions.length - 1];
    live.send({ type: 'thinking', turn_id: 't1', resumed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Working, and replayed' });
    await settle(10);
  });
  assert.ok(!text().includes('Working, and replayed'));
  assert.equal(container.querySelector('button[aria-label="Stop generating"]'), null);
  await finish(...subscriptions);
});

test('a stream that ends without saying the turn is over hands the turn to the event stream', async () => {
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
    stream.send({ type: 'stream', turn_id: 't1', content: 'Half' });
    await settle(10);
    stream.close();
    await settle(10);
  });
  assert.ok(container.querySelector('button[aria-label="Stop generating"]'), 'not taken for the finished answer');
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 2, 'followed under a new client id');
  await act(async () => {
    const live = subscriptions[subscriptions.length - 1];
    live.send({ type: 'thinking', turn_id: 't1', resumed: true });
    live.send({ type: 'done', turn_id: 't1', content: 'Half, then whole', message_id: 'm2' });
    await settle(10);
  });
  assert.ok(text().includes('Half, then whole'));
  await finish(...subscriptions);
});

test('a Stop with nothing held does not take back a message held during a later turn', async () => {
  const stream = sseStream();
  const events = sseStream();
  let turns = 0;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      turns += 1;
      return turns === 1 ? stream.response() : sseStream().response();
    },
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', holdSendsDuringTurn: true, apiEndpoints: { events: '/chat/conversations', steer: null } }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  // Another tab's turn; a message held meanwhile goes when it ends.
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't2' });
    events.send({ type: 'stream', turn_id: 't2', content: 'elsewhere' });
    await settle(10);
  });
  await typeAndHold(ref, 'after that');
  await act(async () => {
    events.send({ type: 'done', turn_id: 't2', content: 'elsewhere', message_id: 'm5' });
    await settle(10);
  });
  assert.deepEqual(
    messages(requests).map((r) => (r.body as { content: string }).content),
    ['first', 'after that'],
  );
  await finish(stream, events);
});

test('a read-back the backend could not be reached for is tried again once the browser is back online', async () => {
  let down = true;
  const requests = fakeBackend([
    agentsRoute,
    (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (down) throw new TypeError('network error');
      return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'assistant', content: 'The answer that was owed' }] });
    },
  ]);
  await render({ conversationId: 'c1' });
  assert.ok(!text().includes('The answer that was owed'));
  down = false;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 2);
  assert.ok(text().includes('The answer that was owed'));
});

test('the event stream waits for a history actually read back, not one skipped for want of an agent', async () => {
  let list: typeof AGENTS = [];
  const events = sseStream();
  const requests = fakeBackend([
    (req) => (req.url === '/api/chat/agents' ? json(list) : undefined),
    restoreRoute([{ id: 'm1', role: 'user', content: 'asked earlier' }]),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 0);
  list = [...AGENTS];
  await act(async () => {
    ref.current!.reloadAgents();
    await settle(10);
  });
  assert.ok(text().includes('asked earlier'));
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 1);
  await finish(events);
});

test('a stopped relayed turn that names no turn stays stopped, its stored end too, and the next turn shows', async () => {
  const events = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    events.send({ type: 'thinking' });
    events.send({ type: 'stream', content: 'unnamed' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'stream', content: 'unnamed, still going' });
    events.send({ type: 'cancelled' });
    events.send({ type: 'done', content: 'unnamed, stored', message_id: 'm7' });
    await settle(10);
  });
  assert.ok(!text().includes('still going'));
  assert.ok(!text().includes('unnamed, stored'));
  await act(async () => {
    events.send({ type: 'thinking' });
    events.send({ type: 'stream', content: 'a later turn' });
    await settle(10);
  });
  assert.ok(text().includes('a later turn'));
  await finish(events);
});

test('a steered turn whose stream drops keeps its closed segments; the replay brings back the one being written', async () => {
  const stream = sseStream();
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  fakeBackend([
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
    stream.send({ type: 'stream', turn_id: 't1', content: 'Part one' });
    stream.send({ type: 'done', turn_id: 't1', content: 'Part one', intermediate: true });
    stream.send({ type: 'stream', turn_id: 't1', content: 'Part two' });
    await settle(10);
  });
  await act(async () => {
    stream.fail();
    await settle(10);
  });
  // XTM One's snapshot: the ack, then the segment being written only (its
  // journal starts the answer over at an intermediate `done`).
  await act(async () => {
    const live = subscriptions[subscriptions.length - 1];
    live.send({ type: 'thinking', turn_id: 't1', resumed: true, relayed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Part two, and more', relayed: true });
    await settle(10);
  });
  assert.equal(text().split('Part one').length - 1, 1, 'the closed segment stays, once');
  assert.equal(text().split('Part two').length - 1, 1, 'the segment being written shows once, replayed');
  assert.ok(text().includes('Part two, and more'));
  await finish(...subscriptions);
});

test('the host is told what became of each held send', async () => {
  const streams = [sseStream(), sseStream(), sseStream()];
  let turns = 0;
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? streams[turns++].response() : undefined)]);
  const ref = createRef<Handle>();
  const settled: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { steer: null },
      onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`),
    },
    ref,
  );
  // Sent as the next turn.
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    void ref.current!.send('next');
    await settle(10);
    streams[0].send({ type: 'done', content: 'ok', conversation_id: 'c1' });
    streams[0].close();
    await settle(10);
  });
  assert.deepEqual(settled, ['next:sent'], 'told as the backend takes it, its answer still to come');
  // A host's send, stopped: nothing comes back to the composer, and it goes nowhere.
  await act(async () => {
    void ref.current!.send('then this');
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.deepEqual(settled, ['next:sent', 'then this:dropped']);
  // Still held when the panel goes: cancelled.
  await act(async () => {
    void ref.current!.send('a third');
    await settle(10);
    void ref.current!.send('left behind');
    await settle(10);
  });
  await unmount();
  assert.deepEqual(settled, ['next:sent', 'then this:dropped', 'left behind:cancelled']);
  await finish(...streams);
});

test('an owed read-back never lands over a turn on screen, and comes once the turn is over', async () => {
  let restores = 0;
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      restores += 1;
      if (restores === 1) return json({ detail: 'restarting' }, 503);
      return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'assistant', content: 'From the history' }] });
    },
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('a new question');
    await settle(10);
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'A live answer' });
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.equal(restores, 1, 'not while the turn runs');
  assert.ok(text().includes('a new question') && text().includes('A live answer'));
  await act(async () => {
    stream.send({ type: 'done', content: 'A live answer', conversation_id: 'c1' });
    stream.close();
    await settle(10);
  });
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 2, 'read back once idle');
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.equal(restores, 2, 'and not again once read back');
});

test('a conversation left and come back to waits for its history before its event stream', async () => {
  let release: (() => void) | null = null;
  let restores = 0;
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const requests = fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      restores += 1;
      if (restores === 2) await new Promise<void>((resolve) => (release = resolve));
      return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'user', content: 'asked earlier' }] });
    },
    (req) => {
      if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
      const events = sseStream();
      subscriptions.push(events);
      return events.response();
    },
  ]);
  const ref = createRef<Handle>();
  await render({ apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle(10);
  });
  assert.equal(subscriptions.length, 1);
  await act(async () => {
    ref.current!.newConversation();
    await settle(10);
  });
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle(10);
  });
  const order = requests
    .filter((r) => r.url.includes('/events') || (r.url === '/api/chat/sessions' && r.method === 'POST'))
    .map((r) => (r.url.includes('/events') ? 'events' : 'restore'));
  assert.deepEqual(order, ['restore', 'events', 'restore'], 'no event stream before the second read-back');
  await act(async () => {
    release?.();
    await settle(10);
  });
  assert.equal(subscriptions.length, 2);
  await finish(...subscriptions);
});

test('a history read back during a turn goes above it once the turn ends, and only then is the event stream followed', async () => {
  let release!: () => void;
  const restored = new Promise<void>((resolve) => (release = resolve));
  const stream = sseStream();
  const events = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      await restored;
      return json({
        conversation_id: 'c1',
        agent_name: 'Restored Agent',
        messages: [
          { id: 'm1', role: 'user', content: 'an old question' },
          { id: 'm2', role: 'assistant', content: 'an old answer' },
        ],
      });
    },
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  // Typed and sent while the history is still being read back.
  await act(async () => {
    ref.current!.setDraft('a new question');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle(10);
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'A live answer' });
    release();
    await settle(10);
  });
  assert.ok(text().includes('Restored Agent'), "the restored agent's name shows at once");
  assert.ok(!text().includes('an old answer'), 'the history waits for the turn');
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 0, 'and so does the event stream');
  await act(async () => {
    stream.send({ type: 'done', content: 'A live answer', conversation_id: 'c1' });
    stream.close();
    await settle(10);
  });
  const shown = text();
  assert.ok(shown.indexOf('an old answer') >= 0 && shown.indexOf('an old answer') < shown.indexOf('a new question'), 'above the turn');
  assert.ok(shown.includes('A live answer'), 'the turn stays');
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 1, 'no second read-back');
  assert.equal(requests.filter((r) => r.url.includes('/events')).length, 1);
  await finish(events);
});

test('a host callback that throws breaks neither the send nor the turn', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const original = console.error;
  console.error = () => undefined;
  try {
    await render(
      {
        onBeforeSend: () => {
          throw new Error('host bug');
        },
        onStreamEvent: () => {
          throw new Error('host bug');
        },
      },
      ref,
    );
    await act(async () => {
      void ref.current!.send('hello');
      await settle();
      stream.send({ type: 'stream', content: 'Still answered' });
      stream.send({ type: 'done', content: 'Still answered', conversation_id: 'c1' });
      stream.close();
      await settle(10);
    });
  } finally {
    console.error = original;
  }
  assert.equal(messages(requests).length, 1, 'the send went out');
  assert.ok(text().includes('Still answered'));
  assert.equal(container.querySelector('button[aria-label="Stop generating"]'), null, 'and the turn ended');
});

test('switching conversations tells the host the one switched to, never an empty one between', async () => {
  fakeBackend([
    agentsRoute,
    (req) =>
      req.url === '/api/chat/sessions' && req.method === 'POST'
        ? json({ conversation_id: (req.body as { conversation_id: string }).conversation_id, messages: [] })
        : undefined,
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ onConversationChange: (id) => changes.push(id) }, ref);
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle(10);
  });
  await act(async () => {
    ref.current!.selectConversation('c2');
    await settle(10);
  });
  assert.deepEqual(changes, ['c1', 'c2']);
  await act(async () => {
    ref.current!.newConversation();
    await settle(10);
  });
  assert.deepEqual(changes, ['c1', 'c2', null], 'a new chat still says so');
});

test('a history read back with the message sent meanwhile shows that message once', async () => {
  let release!: () => void;
  const restored = new Promise<void>((resolve) => (release = resolve));
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      await restored;
      return json({
        conversation_id: 'c1',
        messages: [
          { id: 'm1', role: 'user', content: 'an old question' },
          { id: 'm2', role: 'assistant', content: 'an old answer' },
          { id: 'm3', role: 'user', content: 'a new question' },
        ],
      });
    },
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    ref.current!.setDraft('a new question');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle(10);
  });
  await act(async () => {
    release();
    await settle(10);
  });
  await finish(stream);
  const shown = [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((e) => e.textContent);
  assert.deepEqual(shown, ['an old question', 'a new question']);
});

test('a file that failed to upload offers neither a steer nor a hold while the turn runs', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/upload' ? json({ detail: 'too large' }, 500) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', steerAttachments: true, holdSendsDuringTurn: true }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle(10);
  });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await act(async () => {
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('with this file');
    await settle();
  });
  assert.equal(container.querySelector('button[aria-label="Send now"]'), null);
  assert.equal(container.querySelector('button[aria-label="Send when the answer ends"]'), null);
  assert.ok(!text().includes('Enter to send now'), 'nor says Enter sends it');
  await finish(stream);
});

test("a send refused before its stream shows the backend's detail, and the generic words only when there is none", async () => {
  const answers = [
    () => json({ detail: 'Too many messages. Try again in 30 seconds.' }, 429),
    () => json({ detail: { code: 'pack_invalid', message: 'The pack "apt" does not exist.' } }, 400),
    () => json({ detail: { code: 'held', detail: 'This conversation is held by a channel.' } }, 409),
    () => new Response('<html>Bad gateway</html>', { status: 502 }),
  ];
  let sent = 0;
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? answers[sent++]() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  const outcomes: unknown[] = [];
  for (const message of ['one', 'two', 'three', 'four']) {
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = ref.current!.send(message);
      await settle(10);
    });
    outcomes.push(await outcome);
  }
  assert.deepEqual(outcomes, ['failed', 'failed', 'failed', 'failed']);
  assert.ok(text().includes('Too many messages. Try again in 30 seconds.'));
  assert.ok(text().includes('The pack "apt" does not exist.'));
  assert.ok(text().includes('This conversation is held by a channel.'));
  assert.equal(text().split('Unable to connect. Please check the configuration.').length - 1, 1, 'only the refusal with no detail');
});

test('a read-back refused for its credentials keeps the conversation, and is read again with new credentials or on retry', async () => {
  let allowed = 'Bearer fresh';
  const requests = fakeBackend([
    agentsRoute,
    (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (req.headers.authorization !== allowed)
        return req.headers.authorization === 'Bearer gone' ? json({}, 403) : json({ detail: 'Your session has expired.' }, 401);
      return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'assistant', content: 'The answer kept' }] });
    },
  ]);
  const restores = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length;
  const changes: (string | null)[] = [];
  const props = { conversationId: 'c1', onConversationChange: (id: string | null) => changes.push(id) };
  await render({ ...props, requestHeaders: { Authorization: 'Bearer stale' } });
  assert.deepEqual(changes, [], 'the conversation is kept');
  assert.ok(container.querySelector('[data-testid="filigran-chat-restore-error"]'));
  assert.ok(text().includes('Your session has expired.'));
  // The same credentials, in a new object: nothing to retry with.
  await render({ ...props, requestHeaders: { Authorization: 'Bearer stale' } });
  assert.equal(restores(), 1);
  // The host refreshed its token.
  await render({ ...props, requestHeaders: { Authorization: 'Bearer fresh' } });
  assert.equal(restores(), 2);
  assert.ok(text().includes('The answer kept'));
  assert.equal(container.querySelector('[data-testid="filigran-chat-restore-error"]'), null);
  assert.deepEqual(changes, []);

  // A 403 with no detail, then the user retries once the backend lets them in.
  await unmount();
  allowed = 'none yet';
  await render({ ...props, requestHeaders: { Authorization: 'Bearer gone' } });
  assert.ok(text().includes('This conversation could not be loaded.'));
  allowed = 'Bearer gone';
  await act(async () => {
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'Retry')!.click();
    await settle(10);
  });
  assert.ok(text().includes('The answer kept'));
  assert.deepEqual(changes, []);
});

test('an event stream refused for its credentials reopens once each time they change', async () => {
  let allowed = 'Bearer fresh';
  const events = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => {
      if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
      return req.headers.authorization === allowed ? events.response() : json({ detail: 'Not authenticated' }, 401);
    },
  ]);
  const subscriptions = () => requests.filter((r) => r.url.includes('/events'));
  const props = { conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } };
  allowed = 'none yet';
  await render({ ...props, requestHeaders: { Authorization: 'Bearer stale' } });
  assert.equal(subscriptions().length, 1);
  await render({ ...props, requestHeaders: { Authorization: 'Bearer stale' } });
  assert.equal(subscriptions().length, 1, 'not reopened with the credentials refused');
  await render({ ...props, requestHeaders: { Authorization: 'Bearer newer' } });
  assert.equal(subscriptions().length, 2, 'reopened with new ones');
  await act(async () => settle(10));
  assert.equal(subscriptions().length, 2, 'refused again: tried once, not in a loop');
  allowed = 'Bearer fresh';
  await render({ ...props, requestHeaders: { Authorization: 'Bearer fresh' } });
  assert.equal(subscriptions().length, 3);
  assert.equal(subscriptions()[2].headers.authorization, 'Bearer fresh');
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't1' });
    events.send({ type: 'stream', turn_id: 't1', content: 'Relayed once allowed' });
    await settle(10);
  });
  assert.ok(text().includes('Relayed once allowed'));
  // A live stream is not reopened when the credentials rotate.
  await render({ ...props, requestHeaders: { Authorization: 'Bearer rotated' } });
  assert.equal(subscriptions().length, 3);
  await finish(events);
});

test('the event stream closes once the page has been hidden 60 s, and reopens with a read-back when shown', async () => {
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  // The 60 s timers are run by hand; every other timer runs as usual.
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  const longTimers = new Map<number, () => void>();
  let nextLongTimer = -1;
  window.setTimeout = ((fn: () => void, ms?: number, ...args: unknown[]) => {
    if (ms !== 60000) return realSetTimeout(fn, ms, ...args);
    longTimers.set(nextLongTimer, fn);
    return nextLongTimer--;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => (longTimers.delete(id!) ? undefined : realClearTimeout(id))) as typeof window.clearTimeout;
  const setVisibility = (state: string) =>
    act(async () => {
      visibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle(10);
    });
  try {
    let restores = 0;
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const requests = fakeBackend([
      agentsRoute,
      (req) => {
        if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
        restores += 1;
        return json({ conversation_id: 'c1', messages: [{ id: 'm1', role: 'user', content: 'asked earlier' }] });
      },
      (req) => {
        if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
        const events = sseStream();
        subscriptions.push(events);
        return events.response();
      },
    ]);
    const opened = () => requests.filter((r) => r.url.includes('/events')).length;
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } });
    assert.equal(opened(), 1);
    assert.equal(restores, 1);

    // A short look away keeps the stream.
    await setVisibility('hidden');
    assert.equal(longTimers.size, 1);
    await setVisibility('visible');
    assert.equal(longTimers.size, 0, 'the close is called off');
    assert.equal(opened(), 1);

    await act(async () => {
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Relayed so far' });
      await settle(10);
    });
    assert.ok(text().includes('Relayed so far'));

    await setVisibility('hidden');
    await act(async () => {
      for (const fn of [...longTimers.values()]) fn();
      longTimers.clear();
      await settle(10);
    });
    assert.ok(!text().includes('Relayed so far'), 'the turn it fed goes, to be replayed whole');
    assert.ok(!container.querySelector('button[aria-label="Stop generating"]'));
    await act(async () => settle(10));
    assert.equal(opened(), 1, 'not reopened while hidden');

    await setVisibility('visible');
    assert.equal(opened(), 2, 'reopened when shown');
    assert.equal(restores, 2, 'and the conversation read back for what ended meanwhile');
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Relayed so far, and the rest' });
      subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Relayed so far, and the rest', message_id: 'm2' });
      await settle(10);
    });
    assert.equal(text().split('Relayed so far').length - 1, 1, 'shown once');
    assert.ok(text().includes('and the rest'));
    await finish(...subscriptions);
  } finally {
    window.setTimeout = realSetTimeout;
    window.clearTimeout = realClearTimeout;
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

test('each answer says which agent wrote it and whether it is a note for one that failed, live and restored', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([
      { id: 'm1', role: 'user', content: '@Analyst @Hunter look' },
      { id: 'm2', role: 'assistant', content: 'Restored reply', answered_by: { agent_id: 'a2', agent_name: 'Analyst', agent_icon: '🛰️' } },
      { id: 'm3', role: 'assistant', content: 'Restored note', answered_by: { agent_id: 'a1', agent_name: 'Hunter' }, mention_failed: true },
    ]),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  const attribution = (m: import('../types.ts').ChatMessage) =>
    m.role === 'assistant' && m.content ? (
      <span data-testid="attribution">{`${m.content}|${m.answeredBy?.agentId ?? '-'}|${m.answeredBy?.agentName ?? '-'}|${m.mentionFailed ? 'failed' : 'answered'}`}</span>
    ) : null;
  await render({ conversationId: 'c1', renderMessageExtras: attribution }, ref);
  await act(async () => {
    void ref.current!.send('@Analyst @Hunter again');
    await settle();
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'Live reply' });
    stream.send({ type: 'done', content: 'Live reply', intermediate: true, answered_by: { agent_id: 'a2', agent_name: 'Analyst' } });
    stream.send({ type: 'stream', content: 'Live note' });
    stream.send({ type: 'done', content: 'Live note', answered_by: { agent_id: 'a1', agent_name: 'Hunter' }, mention_failed: true });
    await settle(10);
  });
  const shown = [...container.querySelectorAll('[data-testid="attribution"]')].map((e) => e.textContent);
  assert.deepEqual(shown, [
    'Restored reply|a2|Analyst|answered',
    'Restored note|a1|Hunter|failed',
    'Live reply|a2|Analyst|answered',
    'Live note|a1|Hunter|failed',
  ]);
  await finish(stream);
});
