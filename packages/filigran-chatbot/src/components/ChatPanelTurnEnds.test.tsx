/**
 * Rendering tests of how a turn ends and what a send carries while one runs -
 * `yarn test`: a provisional end and the stored end that follows it, a relayed
 * turn across an event stream reopened, Stop refused or answered with no turn,
 * steers refused, and the host's fields and hook on a held message.
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
type TurnEnd = import('../types.ts').ChatTurnEnd;

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
const restoreRoute = (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: [] }) : undefined;
const sent = (requests: RecordedRequest[], url: string) => requests.filter((r) => r.url === url);
const text = () => container.textContent ?? '';
const answers = () => [...container.querySelectorAll('[data-testid="filigran-chat-assistant-message"]')].map((e) => e.textContent ?? '');
const stopShown = () => !!container.querySelector('button[aria-label="Stop generating"]');
const notice = () => container.querySelector('[data-testid="filigran-chat-composer-notice"]')?.textContent ?? null;
/** Close what a test left open, inside `act`: the panel answers it with updates. */
const finish = (...streams: { close: () => void }[]) =>
  act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });

/** What the host heard: `running` as a turn starts, how it ended as it stops. */
function turnLog() {
  const heard: string[] = [];
  const onTurnRunningChange = (running: boolean, info?: TurnEnd) => heard.push(running ? 'running' : (info?.ended ?? 'no outcome'));
  return { heard, onTurnRunningChange };
}

/** An event stream route that opens a fresh stream per subscription. */
function eventsRoute(subscriptions: ReturnType<typeof sseStream>[]) {
  return (req: RecordedRequest) => {
    if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
    const events = sseStream();
    subscriptions.push(events);
    return events.response();
  };
}

/**
 * Run the timers of *delays* by hand (the event stream's backoff with no
 * jitter, the resume grace); every other timer runs as usual.
 */
function manualTimers(delays: number[]) {
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  const realRandom = Math.random;
  const held = new Map<number, { ms: number; fn: () => void }>();
  let next = -1;
  window.setTimeout = ((fn: () => void, ms?: number, ...args: unknown[]) => {
    if (ms === undefined || !delays.includes(ms)) return realSetTimeout(fn, ms, ...args);
    held.set(next, { ms, fn });
    return next--;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => (held.delete(id!) ? undefined : realClearTimeout(id))) as typeof window.clearTimeout;
  Math.random = () => 1;
  return {
    pending: () => [...held.values()].map((t) => t.ms),
    run: (ms: number) =>
      act(async () => {
        for (const [id, timer] of [...held.entries()]) {
          if (timer.ms !== ms) continue;
          held.delete(id);
          timer.fn();
        }
        await settle(10);
      }),
    restore: () => {
      window.setTimeout = realSetTimeout;
      window.clearTimeout = realClearTimeout;
      Math.random = realRandom;
    },
  };
}

test('a relayed turn ended provisionally takes its stored end as its answer’s id, opening no second turn', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  fakeBackend([agentsRoute, restoreRoute, eventsRoute(subscriptions)]);
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange });
  const live = subscriptions[0];

  // A failed loop: the provisional error, then the stored `done`.
  await act(async () => {
    live.send({ type: 'thinking', turn_id: 't1', relayed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Partial', relayed: true });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'error', turn_id: 't1', content: 'I encountered an error: boom', relayed: true });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'failed']);
  await act(async () => {
    live.send({ type: 'done', turn_id: 't1', content: 'I encountered an error: boom', message_id: 'm1', relayed: true });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'failed'], 'the stored end starts no turn');
  assert.deepEqual(answers().length, 1);
  assert.ok(container.querySelector('[data-message-id="m1"]'), 'the answer takes the stored id');

  // A Stop acknowledged, then the stored `cancelled`.
  await act(async () => {
    live.send({ type: 'thinking', turn_id: 't2', relayed: true });
    live.send({ type: 'stream', turn_id: 't2', content: 'Halfway', relayed: true });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'cancelled', turn_id: 't2', relayed: true });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'stream', turn_id: 't2', content: 'Halfway, then more', relayed: true });
    live.send({ type: 'cancelled', turn_id: 't2', message_id: 'm2', relayed: true });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'failed', 'running', 'stopped']);
  assert.equal(answers().length, 2);
  assert.ok(!text().includes('then more'), 'nothing of an ended turn lands');
  assert.ok(container.querySelector('[data-message-id="m2"]'));

  // The next turn shows as usual.
  await act(async () => {
    live.send({ type: 'thinking', turn_id: 't3', relayed: true });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'done', turn_id: 't3', content: 'A later answer', message_id: 'm3', relayed: true });
    await settle(10);
  });
  assert.deepEqual(heard.slice(4), ['running', 'answered']);
  assert.ok(text().includes('A later answer'));
  await finish(...subscriptions);
});

test('the own stream is read past a provisional end for the stored end’s id, the turn over at once', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', onTurnRunningChange }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'turn_started', turn_id: 't1' });
    stream.send({ type: 'stream', turn_id: 't1', content: 'Some' });
    stream.send({ type: 'error', turn_id: 't1', content: 'I encountered an error: boom' });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'failed'], 'over when the provisional end comes');
  assert.equal(stopShown(), false);
  await act(async () => {
    stream.send({ type: 'done', turn_id: 't1', content: 'I encountered an error: boom (stored)', message_id: 'm7' });
    stream.send({ type: 'stream', turn_id: 't1', content: 'never shown' });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'failed'], 'the stored end keeps the outcome');
  assert.ok(container.querySelector('[data-message-id="m7"]'), 'and gives the answer its id');
  assert.ok(text().includes('(stored)'));
  assert.ok(!text().includes('never shown'));
  await finish(stream);
});

test('a relayed turn is over when the reopened event stream does not replay it, and goes on when it does; a clean close retries at once', async () => {
  const timers = manualTimers([1000, 2000, 4000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const requests = fakeBackend([agentsRoute, restoreRoute, eventsRoute(subscriptions)]);
    const { heard, onTurnRunningChange } = turnLog();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange });
    const restores = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length;
    const restoresBefore = restores();

    await act(async () => {
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Relayed' });
      await settle(10);
    });
    assert.deepEqual(heard, ['running']);
    // The server ends the stream (its lifetime); the turn ends while it is away.
    await finish(subscriptions[0]);
    assert.deepEqual(timers.pending(), [1000]);
    await timers.run(1000);
    assert.equal(subscriptions.length, 2);
    assert.deepEqual(heard, ['running'], 'not over before the snapshot had its chance');
    await timers.run(5000);
    assert.deepEqual(heard, ['running', 'stopped'], 'no replay: the turn is over');
    assert.equal(stopShown(), false);
    assert.equal(restores(), restoresBefore + 1, 'and its end is read back');

    // A stream that opened and closed with no frame on it is retried from the shortest delay.
    await finish(subscriptions[1]);
    assert.deepEqual(timers.pending(), [1000]);
    await timers.run(1000);
    assert.equal(subscriptions.length, 3);

    // A turn still running is replayed whole, and runs on throughout.
    await act(async () => {
      subscriptions[2].send({ type: 'thinking', turn_id: 't2' });
      subscriptions[2].send({ type: 'stream', turn_id: 't2', content: 'Part one' });
      subscriptions[2].send({ type: 'done', turn_id: 't2', content: 'Part one', intermediate: true });
      subscriptions[2].send({ type: 'stream', turn_id: 't2', content: 'Part two' });
      await settle(10);
    });
    await finish(subscriptions[2]);
    await timers.run(1000);
    await act(async () => {
      subscriptions[3].send({ type: 'thinking', turn_id: 't2', resumed: true });
      subscriptions[3].send({ type: 'stream', turn_id: 't2', content: 'Part one' });
      subscriptions[3].send({ type: 'done', turn_id: 't2', content: 'Part one', intermediate: true });
      subscriptions[3].send({ type: 'stream', turn_id: 't2', content: 'Part two, and more' });
      await settle(10);
    });
    assert.deepEqual(timers.pending(), [], 'the replay called the wait off');
    assert.deepEqual(heard.slice(2), ['running']);
    assert.equal(text().split('Part one').length - 1, 1, 'the first segment shows once');
    await act(async () => {
      subscriptions[3].send({ type: 'done', turn_id: 't2', content: 'Part two, and more, done' });
      await settle(10);
    });
    assert.deepEqual(heard.slice(2), ['running', 'answered']);
    await finish(...subscriptions);
  } finally {
    timers.restore();
  }
});

test('Stop lets go at once when no turn runs anywhere, and keeps a turn whose Stop the backend refuses', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  let cancelAnswer = () => json({ status: 'cancelled', turn: 'none' }, 202);
  fakeBackend([
    agentsRoute,
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? cancelAnswer() : undefined),
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' }, onTurnRunningChange }, ref);
  const start = async (stream: ReturnType<typeof sseStream>) =>
    act(async () => {
      void ref.current!.send('go');
      await settle();
      stream.send({ type: 'stream', content: 'Working' });
      await settle(10);
    });

  await start(streams[0]);
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped'], 'nothing will say cancelled: stopped now');
  assert.ok(!text().includes('Stopping…'));

  cancelAnswer = () => json({ detail: 'The running response cannot be reached right now. Try again shortly.' }, 503);
  await start(streams[1]);
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.deepEqual(heard.slice(2), ['running'], 'a refused Stop keeps the turn');
  assert.ok(stopShown());
  assert.ok(!text().includes('Stopping…'));
  assert.equal(notice(), 'The running response cannot be reached right now. Try again shortly.');
  await act(async () => {
    streams[1].send({ type: 'done', content: 'Working, done' });
    streams[1].close();
    await settle(10);
  });
  assert.deepEqual(heard.slice(2), ['running', 'answered']);
  assert.equal(notice(), null, 'the notice goes with the turn');
  await finish(...streams);
});

test('a refused steer fails and says why; one refused because the turn just ended is held and sent', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const steers: (() => Response | Promise<Response>)[] = [
    () => json({ detail: 'This message is too long to steer the response' }, 422),
    // The turn ends locally while this one is on its way.
    () => new Promise<Response>((resolve) => (releaseSteer = () => resolve(json({ detail: 'No response is currently being generated' }, 409)))),
  ];
  let releaseSteer!: () => void;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? steers.shift()!() : undefined),
  ]);
  const ref = createRef<Handle>();
  const settled: string[] = [];
  await render({ conversationId: 'c1', holdSendsDuringTurn: true, onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`) }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle(10);
  });
  let outcome!: Promise<unknown>;
  await act(async () => {
    outcome = ref.current!.send('too long');
    await settle(10);
  });
  assert.equal(await outcome, 'failed');
  assert.equal(notice(), 'This message is too long to steer the response');

  let late!: Promise<unknown>;
  await act(async () => {
    late = ref.current!.send('just in time');
    await settle(10);
  });
  assert.equal(notice(), null, 'a new send clears the notice');
  await act(async () => {
    streams[0].send({ type: 'done', content: 'ok' });
    streams[0].close();
    await settle(10);
  });
  await act(async () => {
    releaseSteer();
    await settle(20);
  });
  assert.equal(await late, 'held');
  assert.deepEqual(
    sent(requests, '/api/chat/messages').map((r) => (r.body as { content: string }).content),
    ['first', 'just in time'],
  );
  assert.deepEqual(settled, ['just in time:sent']);
  await finish(...streams);
});

test('a send with fields of its own is held, not steered, keeps them, and the send hook is asked again as it leaves', async () => {
  const streams = [sseStream(), sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  const asked: string[] = [];
  const settled: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`),
      onBeforeSend: (draft) => {
        asked.push(`${draft.text}:${draft.source}:${draft.turnRunning ? 'running' : 'idle'}`);
        if (draft.text === 'scoped') return { extras: { scope: 'kb' }, text: draft.turnRunning ? 'scoped (running)' : 'scoped (idle)' };
        if (draft.text === 'withdrawn' && !draft.turnRunning) return false;
        return undefined;
      },
    },
    ref,
  );
  const body = (i: number) => sent(requests, '/api/chat/messages')[i]?.body as Record<string, unknown> | undefined;
  const steered = () => sent(requests, '/api/chat/messages/steer').length;

  await act(async () => {
    void ref.current!.send('first');
    await settle(10);
  });
  const outcomes: Promise<unknown>[] = [];
  await act(async () => {
    outcomes.push(ref.current!.send('plain'));
    await settle(10);
    outcomes.push(ref.current!.send('scoped'));
    await settle(10);
  });
  assert.deepEqual(await Promise.all(outcomes), ['steered', 'held'], "the hook's fields keep it from steering");
  assert.equal(steered(), 1);
  await act(async () => {
    streams[0].send({ type: 'done', content: 'ok' });
    streams[0].close();
    await settle(20);
  });
  assert.deepEqual(asked.slice(-2), ['scoped:host:running', 'scoped:host:idle'], 'asked again, the turn over');
  assert.equal(body(1)?.content, 'scoped (idle)', 'as the hook decided then');
  assert.equal(body(1)?.scope, 'kb');

  // The handle's own fields: held, and sent with the message.
  await act(async () => {
    outcomes.push(ref.current!.send('handle fields', { extras: { mode: 'deep' } }));
    await settle(10);
  });
  assert.equal(await outcomes[2], 'held');
  assert.equal(steered(), 1);
  await act(async () => {
    streams[1].send({ type: 'done', content: 'ok' });
    streams[1].close();
    await settle(20);
  });
  assert.equal(body(2)?.content, 'handle fields');
  assert.equal(body(2)?.mode, 'deep');

  // Taken over by the hook as it leaves: it goes nowhere.
  await act(async () => {
    void ref.current!.send('withdrawn', { extras: { mode: 'deep' } });
    await settle(10);
  });
  await act(async () => {
    streams[2].send({ type: 'done', content: 'ok' });
    streams[2].close();
    await settle(20);
  });
  assert.equal(sent(requests, '/api/chat/messages').length, 3);
  assert.deepEqual(settled.slice(-1), ['withdrawn:dropped']);
  await finish(...streams);
});

test('a page served over plain http, without crypto.randomUUID, still sends', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1' }, ref);
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = ref.current!.send('over http');
      await settle(10);
    });
    assert.equal(await outcome, 'sent');
    await act(async () => {
      stream.send({ type: 'done', content: 'Answered' });
      await settle(10);
    });
    assert.ok(text().includes('over http'), text());
    assert.ok(text().includes('Answered'), text());
  } finally {
    delete (crypto as unknown as Record<string, unknown>).randomUUID;
  }
  await finish(stream);
});
