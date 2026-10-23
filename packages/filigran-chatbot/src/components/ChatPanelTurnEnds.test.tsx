/**
 * Rendering tests of how a turn ends and what a send carries while one runs -
 * `yarn test`: a provisional end and the stored end that follows it, a relayed
 * turn across an event stream reopened, Stop refused or answered with no turn,
 * steers refused, and the host's fields and hook on a held message.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import { agentsRoute, container, eventsRoute, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';

type TurnEnd = import('../types.ts').ChatTurnEnd;

const { render, unmount } = mountPanels();

const sent = (requests: RecordedRequest[], url: string) => requests.filter((r) => r.url === url);
const answers = () => [...container.querySelectorAll('[data-testid="filigran-chat-assistant-message"]')].map((e) => e.textContent ?? '');
const stopShown = () => !!container.querySelector('button[aria-label="Stop generating"]');
const notice = () => container.querySelector('[data-testid="filigran-chat-composer-notice"]')?.textContent ?? null;

/** What the host heard: `running` as a turn starts, how it ended as it stops. */
function turnLog() {
  const heard: string[] = [];
  const onTurnRunningChange = (running: boolean, info?: TurnEnd) => heard.push(running ? 'running' : (info?.ended ?? 'no outcome'));
  return { heard, onTurnRunningChange };
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
  fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions)]);
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
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
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

test('a relayed turn is over when the reopened event stream does not replay it, and goes on when it does; only a stream that delivered retries at once', async () => {
  const timers = manualTimers([1000, 2000, 4000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const requests = fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions)]);
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

    // A stream that opened and closed at once, with no frame on it, backs off.
    await finish(subscriptions[1]);
    assert.deepEqual(timers.pending(), [2000]);
    await timers.run(2000);
    assert.equal(subscriptions.length, 3);

    // A turn still running is replayed, and runs on throughout: the segment an
    // intermediate `done` closed stays, the one being written is replayed
    // (XTM One's snapshot holds it alone).
    await act(async () => {
      subscriptions[2].send({ type: 'thinking', turn_id: 't2' });
      subscriptions[2].send({ type: 'stream', turn_id: 't2', content: 'Part one' });
      subscriptions[2].send({ type: 'done', turn_id: 't2', content: 'Part one', intermediate: true });
      subscriptions[2].send({ type: 'stream', turn_id: 't2', content: 'Part two' });
      await settle(10);
    });
    await finish(subscriptions[2]);
    assert.deepEqual(timers.pending(), [1000], 'a stream that delivered retries from the shortest delay');
    await timers.run(1000);
    await act(async () => {
      subscriptions[3].send({ type: 'thinking', turn_id: 't2', resumed: true });
      subscriptions[3].send({ type: 'stream', turn_id: 't2', content: 'Part two, and more' });
      await settle(10);
    });
    assert.deepEqual(timers.pending(), [], 'the replay called the wait off');
    assert.deepEqual(heard.slice(2), ['running']);
    assert.equal(text().split('Part one').length - 1, 1, 'the closed segment stays, once');
    assert.equal(text().split('Part two').length - 1, 1, 'the segment being written shows once');
    assert.equal(answers().length, 3, 't1, then t2’s two segments');
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

/**
 * A relayed turn of two segments (the first closed, the second being written)
 * whose event stream ends, and reopens on the turn still running: *stored* is
 * what the history holds by then, *resumed* what the replay writes.
 */
async function resumeRelayedTurn(stored: { id: string; role: 'user' | 'assistant'; content: string }[], resumed: string) {
  const timers = manualTimers([1000, 5000]);
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  let history: unknown[] = [];
  const restore = (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: history }) : undefined;
  const requests = fakeBackend([agentsRoute, restore, eventsRoute(subscriptions)]);
  const restores = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length;
  const log = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange: log.onTurnRunningChange });
  await act(async () => {
    subscriptions[0].send({ type: 'user_message', message: { id: 'u1', role: 'user', content: 'Question' } });
    subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
    subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Seg one' });
    subscriptions[0].send({ type: 'done', turn_id: 't1', content: 'Seg one', message_id: 'a1', intermediate: true });
    subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Seg two, so far' });
    await settle(10);
  });
  const restoresBefore = restores();
  await finish(subscriptions[0]);
  history = stored;
  await timers.run(1000);
  await act(async () => {
    subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
    subscriptions[1].send({ type: 'stream', turn_id: 't1', content: resumed });
    await settle(10);
  });
  return { timers, subscriptions, heard: log.heard, readBacks: () => restores() - restoresBefore };
}
/** The bubbles on screen, in order: the stored id of each, else what it says. */
const thread = () =>
  [...container.querySelectorAll<HTMLElement>('[data-message-id]')].map((e) =>
    /^(u|a)\d$/.test(e.dataset.messageId ?? '') ? e.dataset.messageId : (e.textContent ?? '').includes('Seg') ? 'live' : '?',
  );

test('a relayed turn resumed by a reopened event stream reads back the segments closed meanwhile, its live one after them', async () => {
  const resume = await resumeRelayedTurn(
    [
      { id: 'u1', role: 'user', content: 'Question' },
      { id: 'a1', role: 'assistant', content: 'Seg one' },
      { id: 'a2', role: 'assistant', content: 'Seg two' },
      { id: 'a3', role: 'assistant', content: 'Seg three' },
    ],
    'Seg four, so far',
  );
  try {
    assert.equal(resume.readBacks(), 1, 'the replay reads the conversation back');
    assert.deepEqual(thread(), ['u1', 'a1', 'a2', 'a3', 'live'], 'the closed segments, then the one being written');
    assert.ok(answers()[3].includes('Seg four, so far'));
    assert.equal(text().split('Seg two').length - 1, 1, 'the stale segment the replay wrote over is not left behind');
    assert.deepEqual(resume.heard, ['running'], 'the turn runs on throughout');
    assert.equal(stopShown(), true);
    await act(async () => {
      resume.subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Seg four, done', message_id: 'a4' });
      await settle(10);
    });
    assert.deepEqual(resume.heard, ['running', 'answered']);
    assert.deepEqual(thread(), ['u1', 'a1', 'a2', 'a3', 'a4'], 'one answer each');
    assert.ok(answers()[3].includes('Seg four, done'));
    await finish(...resume.subscriptions);
  } finally {
    resume.timers.restore();
  }
});

test('a relayed turn resumed with no segment closed meanwhile shows each once', async () => {
  const resume = await resumeRelayedTurn(
    [
      { id: 'u1', role: 'user', content: 'Question' },
      { id: 'a1', role: 'assistant', content: 'Seg one' },
    ],
    'Seg two, and more',
  );
  try {
    assert.equal(resume.readBacks(), 1);
    assert.deepEqual(thread(), ['u1', 'a1', 'live']);
    assert.equal(text().split('Seg one').length - 1, 1);
    assert.equal(text().split('Seg two').length - 1, 1);
    assert.deepEqual(resume.heard, ['running']);
    await act(async () => {
      resume.subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Seg two, and more', message_id: 'a2' });
      await settle(10);
    });
    assert.deepEqual(resume.heard, ['running', 'answered']);
    assert.deepEqual(thread(), ['u1', 'a1', 'a2']);
    await finish(...resume.subscriptions);
  } finally {
    resume.timers.restore();
  }
});

test('Stop lets go at once when no turn runs anywhere, and keeps a turn whose Stop the backend refuses', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  let cancelAnswer = () => json({ status: 'cancelled', turn: 'none' }, 202);
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
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

  const restores = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length;
  await start(streams[0]);
  const restoresBefore = restores();
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped'], 'nothing will say cancelled: stopped now');
  assert.ok(!text().includes('Stopping…'));
  assert.equal(restores(), restoresBefore + 1, 'what the turn stored, had it just ended, is read back');

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
    restoreRoute(),
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
    restoreRoute(),
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
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
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

test('a Stop pressed before the own turn starts is asked again once it does, and stops it', async () => {
  const stream = sseStream();
  const cancelAnswers = [() => json({ status: 'cancelled', turn: 'none' }, 202), () => json({ status: 'cancelled', turn: 'local' }, 202)];
  let startTurn!: () => void;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    // XTM One answers a send only once its turn holds the conversation.
    (req) => (req.url === '/api/chat/messages' ? new Promise<Response>((resolve) => (startTurn = () => resolve(stream.response()))) : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? cancelAnswers.shift()!() : undefined),
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' }, onTurnRunningChange }, ref);
  const cancels = () => sent(requests, '/api/chat/messages/cancel').length;
  await act(async () => {
    void ref.current!.send('go');
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.equal(cancels(), 1);
  assert.deepEqual(heard, ['running'], 'a `none` said before the turn started is no word on it');
  assert.ok(text().includes('Stopping…'));

  await act(async () => {
    startTurn();
    await settle();
    stream.send({ type: 'turn_started', turn_id: 't1' });
    await settle(10);
  });
  assert.equal(cancels(), 2, 'asked again as the turn starts');
  await act(async () => {
    stream.send({ type: 'cancelled', turn_id: 't1' });
    stream.send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
    stream.close();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped']);
  assert.equal(cancels(), 2);
});

test('sends wait while the own turn winds down after a provisional end, until its stored end or a while', async () => {
  const timers = manualTimers([5000]);
  try {
    const streams = [sseStream(), sseStream(), sseStream(), sseStream()];
    let next = 0;
    const requests = fakeBackend([
      agentsRoute,
      restoreRoute(),
      (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
      (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'cancelled', turn: 'local' }, 202) : undefined),
    ]);
    const ref = createRef<Handle>();
    const settled: string[] = [];
    const { heard, onTurnRunningChange } = turnLog();
    await render(
      {
        conversationId: 'c1',
        apiEndpoints: { cancel: '/chat/messages/cancel' },
        onTurnRunningChange,
        onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`),
      },
      ref,
    );
    const contents = () => sent(requests, '/api/chat/messages').map((r) => (r.body as { content: string }).content);
    await act(async () => {
      void ref.current!.send('first');
      await settle();
      streams[0].send({ type: 'turn_started', turn_id: 't1' });
      streams[0].send({ type: 'error', turn_id: 't1', content: 'boom' });
      await settle(10);
    });
    assert.deepEqual(heard, ['running', 'failed'], 'over on screen');
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = ref.current!.send('next');
      await settle(10);
    });
    assert.equal(await outcome, 'held', 'held, with no `holdSendsDuringTurn`: the backend still holds the conversation');
    assert.ok(text().includes('Sends when the answer ends:'));
    await act(async () => {
      streams[0].send({ type: 'done', turn_id: 't1', content: 'boom', message_id: 'm1' });
      await settle(20);
    });
    assert.deepEqual(contents(), ['first', 'next'], 'sent once the stored end came');
    assert.deepEqual(settled, ['next:sent']);

    // A stored end that never comes: sent after a while all the same.
    await act(async () => {
      streams[1].send({ type: 'turn_started', turn_id: 't2' });
      streams[1].send({ type: 'cancelled', turn_id: 't2' });
      await settle(10);
    });
    await act(async () => {
      void ref.current!.send('later');
      await settle(10);
    });
    assert.deepEqual(contents(), ['first', 'next']);
    await timers.run(5000);
    assert.deepEqual(contents(), ['first', 'next', 'later']);
    await finish(...streams);
  } finally {
    timers.restore();
  }
});

test('a held message the send hook takes over as it leaves goes back to the composer', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const settled: string[] = [];
  const drafts: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { steer: null },
      // What the composer shows as the host is told.
      onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}:${ref.current!.getDraft()}`),
      onBeforeSend: (draft) => {
        drafts.push(`${draft.text}:${draft.turnRunning ? 'running' : 'idle'}${draft.held ? ':held' : ''}`);
        return draft.held ? false : undefined;
      },
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle();
  });
  await act(async () => {
    ref.current!.setDraft('held text');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send when the answer ends"]')!.click();
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('typed since');
    await settle();
  });
  await act(async () => {
    stream.send({ type: 'done', content: 'ok' });
    stream.close();
    await settle(20);
  });
  assert.deepEqual(drafts.slice(-2), ['held text:running', 'held text:idle:held']);
  assert.equal(sent(requests, '/api/chat/messages').length, 1, 'not sent');
  assert.equal(container.querySelector('textarea')!.value, 'typed since\n\nheld text', 'given back after what was typed since');
  assert.deepEqual(settled, ['held text:returned:typed since\n\nheld text']);
});

test('a relayed turn’s stored end gives its answer everything a live done would, also while the own turn runs', async () => {
  const timers = manualTimers([5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const own = sseStream();
    const requests = fakeBackend([
      agentsRoute,
      restoreRoute(),
      eventsRoute(subscriptions),
      (req) => (req.url === '/api/chat/messages' ? own.response() : undefined),
    ]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    const live = subscriptions[0];
    await act(async () => {
      live.send({ type: 'thinking', turn_id: 't1', relayed: true });
      live.send({ type: 'stream', turn_id: 't1', content: 'Partial', relayed: true });
      live.send({ type: 'error', turn_id: 't1', content: 'boom', relayed: true });
      await settle(10);
    });
    // Sent while that turn winds down: held, then sent after a while.
    await act(async () => {
      void ref.current!.send('mine');
      await settle(10);
    });
    assert.equal(sent(requests, '/api/chat/messages').length, 0);
    await timers.run(5000);
    assert.equal(sent(requests, '/api/chat/messages').length, 1);
    await act(async () => {
      own.send({ type: 'turn_started', turn_id: 't2' });
      own.send({ type: 'stream', turn_id: 't2', content: 'Own answer' });
      await settle(10);
    });
    await act(async () => {
      live.send({
        type: 'done',
        turn_id: 't1',
        content: 'boom, stored',
        message_id: 'm1',
        reasoning: 'Thought it through',
        attachments: [{ file_id: 'f1', filename: 'findings.csv', type: 'csv', size: 12, content_type: 'text/csv', file_tag: 'download_file' }],
        relayed: true,
      });
      await settle(10);
    });
    const answer = container.querySelector('[data-message-id="m1"]');
    assert.ok(answer, 'the stored id, while the own turn runs');
    assert.ok(answer!.textContent!.includes('boom, stored'));
    assert.ok(answer!.textContent!.includes('findings.csv'), 'and its attachments');
    assert.ok(text().includes('Own answer'));
    await finish(own, ...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a relayed turn naming none takes its stored end after a provisional one', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions)]);
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange });
  const live = subscriptions[0];
  await act(async () => {
    live.send({ type: 'thinking' });
    live.send({ type: 'stream', content: 'Halfway' });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'cancelled' });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'stream', content: 'Halfway, then more' });
    live.send({ type: 'cancelled', message_id: 'm4' });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped'], 'no second turn');
  assert.equal(answers().length, 1);
  assert.ok(container.querySelector('[data-message-id="m4"]'));
  assert.ok(!text().includes('then more'));
  await act(async () => {
    live.send({ type: 'thinking' });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'done', content: 'Next turn' });
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped', 'running', 'answered']);
  await finish(...subscriptions);
});

test('a steer refused because the turn just ended goes back to the composer, saying nothing, without held sends', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ detail: 'No response is currently being generated' }, 409) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('steer me');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send now"]')!.click();
    await settle(10);
  });
  assert.equal(notice(), null);
  assert.equal(container.querySelector('textarea')!.value, 'steer me');
  await finish(stream);
});

test('a refused Stop keeps what the turn reported since the click', async () => {
  const stream = sseStream();
  let refuse!: () => void;
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) =>
      req.url === '/api/chat/messages/cancel'
        ? new Promise<Response>((resolve) => (refuse = () => resolve(json({ detail: 'Not now' }, 503))))
        : undefined,
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'status', status: 'thinking_text', content: 'First thoughts. ' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    stream.send({ type: 'status', status: 'thinking_text', content: 'Second thoughts.' });
    await settle(10);
  });
  await act(async () => {
    refuse();
    await settle(10);
  });
  assert.equal(notice(), 'Not now');
  assert.ok(!text().includes('Stopping…'));
  assert.ok(text().includes('Second thoughts.'), 'the reasoning that came since stays');
  await finish(stream);
});

test('an event stream that lived a while retries from the shortest delay, even with no frame on it', async () => {
  const timers = manualTimers([1000, 2000]);
  const realNow = Date.now;
  let offset = 0;
  Date.now = () => realNow() + offset;
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions)]);
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } });
    await finish(subscriptions[0]);
    assert.deepEqual(timers.pending(), [1000]);
    await timers.run(1000);
    offset = 6000;
    await finish(subscriptions[1]);
    assert.deepEqual(timers.pending(), [1000]);
    await timers.run(1000);
    await finish(subscriptions[2]);
    assert.deepEqual(timers.pending(), [2000], 'one that closed at once backs off');
    await timers.run(2000);
    await finish(...subscriptions);
  } finally {
    Date.now = realNow;
    timers.restore();
  }
});

test('a new conversation lets go of the own stream still read for a stored end', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const base = globalThis.fetch;
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/chat/messages') signal = init?.signal;
    return base(input, init);
  }) as typeof fetch;
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'turn_started', turn_id: 't1' });
    stream.send({ type: 'error', turn_id: 't1', content: 'boom' });
    await settle(10);
  });
  assert.equal(signal?.aborted, false, 'read on for its stored end');
  await act(async () => {
    ref.current!.newConversation();
    await settle(10);
  });
  assert.equal(signal?.aborted, true);
  await finish(stream);
});

/** The bubbles on screen, in order: the stored id of each, else the first of *phrases* it says. */
const bubbles = (...phrases: string[]) =>
  [...container.querySelectorAll<HTMLElement>('[data-message-id]')].map((e) =>
    /^(u|a)\d+$/.test(e.dataset.messageId ?? '') ? e.dataset.messageId! : (phrases.find((p) => e.textContent?.includes(p)) ?? '?'),
  );
/** The answer the cancel route gives, as XTM One words it. */
const cancelAnswer = (turn: 'none' | 'local') => json({ status: 'cancelled', turn }, 202);

test('a Stop before the own turn starts says it awaits the send, and goes again only on an answer that no turn runs', async () => {
  const streams = [sseStream(), sseStream()];
  const starts: (() => void)[] = [];
  let answerFirst!: () => void;
  const cancelAnswers: (() => Response | Promise<Response>)[] = [
    () => new Promise<Response>((resolve) => (answerFirst = () => resolve(cancelAnswer('none')))),
    () => cancelAnswer('local'),
    () => cancelAnswer('local'),
  ];
  let next = 0;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      const stream = streams[next++];
      // XTM One answers a send only once its turn holds the conversation.
      return new Promise<Response>((resolve) => starts.push(() => resolve(stream.response())));
    },
    (req) => (req.url === '/api/chat/messages/cancel' ? cancelAnswers.shift()!() : undefined),
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' }, onTurnRunningChange }, ref);
  const cancels = () => sent(requests, '/api/chat/messages/cancel').map((r) => r.body);
  const stopBeforeStart = async (text: string) => {
    await act(async () => {
      void ref.current!.send(text);
      await settle(10);
    });
    await act(async () => {
      ref.current!.stop();
      await settle(10);
    });
  };

  // Answered only once the turn started: `none` then sends it again.
  await stopBeforeStart('go');
  await act(async () => {
    starts[0]();
    await settle();
    streams[0].send({ type: 'turn_started', turn_id: 't1' });
    await settle(10);
  });
  assert.deepEqual(cancels(), [{ conversation_id: 'c1', awaiting_send: true }], 'not again before the answer');
  await act(async () => {
    answerFirst();
    await settle(10);
  });
  assert.deepEqual(cancels(), [{ conversation_id: 'c1', awaiting_send: true }, { conversation_id: 'c1' }], 'again, for the turn started');
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1' });
    streams[0].send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
    streams[0].close();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped']);

  // Answered `local`: the Stop reached a turn, and does not go again.
  await stopBeforeStart('again');
  await act(async () => {
    starts[1]();
    await settle();
    streams[1].send({ type: 'turn_started', turn_id: 't2' });
    await settle(10);
  });
  assert.equal(cancels().length, 3);
  assert.deepEqual(cancels()[2], { conversation_id: 'c1', awaiting_send: true });
  await act(async () => {
    streams[1].send({ type: 'cancelled', turn_id: 't2' });
    streams[1].send({ type: 'cancelled', turn_id: 't2', message_id: 'm2' });
    streams[1].close();
    await settle(10);
  });
  assert.equal(cancels().length, 3, 'never sent again');
  assert.deepEqual(heard, ['running', 'stopped', 'running', 'stopped']);
});

test('a Stop kept for a send that had not started stops that send only, never the next one', async () => {
  // XTM One's rule: a Stop saying it awaits a send no turn holds yet is kept
  // for that send's turn; any other Stop finding no turn keeps nothing.
  let kept = false;
  let running: ReturnType<typeof sseStream> | null = null;
  let turns = 0;
  let releaseFirst!: () => void;
  const streams: ReturnType<typeof sseStream>[] = [];
  const startTurn = () => {
    const stream = sseStream();
    streams.push(stream);
    const turnId = `t${++turns}`;
    stream.send({ type: 'turn_started', turn_id: turnId });
    if (kept) {
      kept = false;
      stream.send({ type: 'cancelled', turn_id: turnId });
      stream.send({ type: 'cancelled', turn_id: turnId, message_id: `m${turns}` });
      stream.close();
    } else {
      running = stream;
    }
    return stream.response();
  };
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      if (turns === 0) return new Promise<Response>((resolve) => (releaseFirst = () => resolve(startTurn())));
      return startTurn();
    },
    (req) => {
      if (req.url !== '/api/chat/messages/cancel') return undefined;
      if (running) {
        running.send({ type: 'cancelled' });
        running.send({ type: 'cancelled', message_id: 'mx' });
        running.close();
        running = null;
        return cancelAnswer('local');
      }
      if ((req.body as { awaiting_send?: boolean }).awaiting_send === true) kept = true;
      return cancelAnswer('none');
    },
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' }, onTurnRunningChange }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    releaseFirst();
    await settle(20);
  });
  assert.deepEqual(heard, ['running', 'stopped'], 'the kept Stop ended the send it was for');
  assert.deepEqual(
    sent(requests, '/api/chat/messages/cancel').map((r) => r.body),
    [{ conversation_id: 'c1', awaiting_send: true }, { conversation_id: 'c1' }],
    'sent again once the turn started, saying no send is awaited',
  );
  assert.equal(kept, false, 'nothing kept for a later send');

  await act(async () => {
    void ref.current!.send('second');
    await settle(10);
  });
  await act(async () => {
    running!.send({ type: 'done', turn_id: 't2', content: 'Answered second', message_id: 'a2' });
    running!.close();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped', 'running', 'answered']);
  assert.ok(text().includes('Answered second'));
});

test('a message sent after a stopped turn ended goes out once it winds down; one held before goes back', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? cancelAnswer('local') : undefined),
  ]);
  const ref = createRef<Handle>();
  const settled: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { cancel: '/chat/messages/cancel', steer: null },
      // What the composer shows as the host is told.
      onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}:${ref.current!.getDraft()}`),
    },
    ref,
  );
  const contents = () => sent(requests, '/api/chat/messages').map((r) => (r.body as { content: string }).content);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    streams[0].send({ type: 'turn_started', turn_id: 't1' });
    streams[0].send({ type: 'stream', turn_id: 't1', content: 'Working' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('typed during');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send when the answer ends"]')!.click();
    await settle(10);
  });
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1' });
    await settle(10);
  });
  assert.deepEqual(settled, ['typed during:returned:typed during'], 'held before the Stop: given back');
  let outcome!: Promise<unknown>;
  await act(async () => {
    outcome = ref.current!.send('after stop');
    await settle(10);
  });
  assert.equal(await outcome, 'held', 'the stopped turn still winds down');
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
    await settle(20);
  });
  assert.deepEqual(contents(), ['first', 'after stop'], 'sent once it wound down');
  assert.deepEqual(settled.slice(1), ['after stop:sent:typed during']);
  await finish(...streams);
});

test('a turn that ended while the event stream was away, another replayed on its return, is read back in place once that one ends', async () => {
  const timers = manualTimers([1000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    let history: unknown[] = [];
    const restore = (req: RecordedRequest) =>
      req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: history }) : undefined;
    fakeBackend([agentsRoute, restore, eventsRoute(subscriptions)]);
    const { heard, onTurnRunningChange } = turnLog();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange });
    await act(async () => {
      subscriptions[0].send({ type: 'user_message', message: { id: 'u1', role: 'user', content: 'First' } });
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'One so far' });
      await settle(10);
    });
    await finish(subscriptions[0]);
    // Meanwhile t1 ended, and t2 started on a message the stream never relayed.
    history = [
      { id: 'u1', role: 'user', content: 'First' },
      { id: 'a1', role: 'assistant', content: 'One, whole' },
      { id: 'u2', role: 'user', content: 'Second' },
    ];
    await timers.run(1000);
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't2', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't2', content: 'Two so far' });
      await settle(10);
    });
    assert.ok(!text().includes('One so far'), 'the answer t1 was writing goes: its stored copy is read back');
    await act(async () => {
      subscriptions[1].send({ type: 'done', turn_id: 't2', content: 'Two, whole', message_id: 'a2' });
      await settle(10);
    });
    assert.deepEqual(heard, ['running', 'answered'], 't2 took over from t1 at once');
    assert.deepEqual(bubbles(), ['u1', 'a1', 'u2', 'a2'], 'in place, each once');
    await finish(...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a read-back the own turn put off joins the thread in place once it ends', async () => {
  const timers = manualTimers([1000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const own = sseStream();
    let history: unknown[] = [];
    let answerRestore: (() => void) | null = null;
    const restore = (req: RecordedRequest) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (history.length === 0) return json({ conversation_id: 'c1', messages: [] });
      return new Promise<Response>((resolve) => (answerRestore = () => resolve(json({ conversation_id: 'c1', messages: history }))));
    };
    fakeBackend([agentsRoute, restore, eventsRoute(subscriptions), (req) => (req.url === '/api/chat/messages' ? own.response() : undefined)]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    await act(async () => {
      subscriptions[0].send({ type: 'user_message', message: { id: 'u1', role: 'user', content: 'Question' } });
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'done', turn_id: 't1', content: 'Seg one', message_id: 'a1', intermediate: true });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Seg two, so far' });
      await settle(10);
    });
    await finish(subscriptions[0]);
    // Segment two closed while the stream was away.
    history = [
      { id: 'u1', role: 'user', content: 'Question' },
      { id: 'a1', role: 'assistant', content: 'Seg one' },
      { id: 'a2', role: 'assistant', content: 'Seg two' },
      { id: 'a3', role: 'assistant', content: 'Seg three' },
      { id: 'u4', role: 'user', content: 'Mine' },
    ];
    await timers.run(1000);
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Seg three, so far' });
      subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Seg three', message_id: 'a3' });
      await settle(10);
    });
    // From the composer: the handle's calls wait for the read-back.
    await act(async () => {
      ref.current!.setDraft('Mine');
      await settle();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
      await settle();
      own.send({ type: 'turn_started', turn_id: 't2' });
      own.send({ type: 'stream', turn_id: 't2', content: 'Own so far' });
      await settle(10);
    });
    // The read-back for t1 lands while the own turn runs: it waits for it.
    await act(async () => {
      answerRestore!();
      await settle(10);
    });
    await act(async () => {
      own.send({ type: 'done', turn_id: 't2', content: 'Own answer', message_id: 'a5' });
      own.close();
      await settle(10);
    });
    assert.deepEqual(bubbles(), ['u1', 'a1', 'a2', 'a3', 'u4', 'a5']);
    await finish(...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a turn replayed after the own stream dropped reads back the segments it closed meanwhile', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const own = sseStream();
  let history: unknown[] = [];
  const restore = (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: history }) : undefined;
  const requests = fakeBackend([
    agentsRoute,
    restore,
    eventsRoute(subscriptions),
    (req) => (req.url === '/api/chat/messages' ? own.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange }, ref);
  const restores = () => requests.filter((r) => r.url === '/api/chat/sessions').length;
  await act(async () => {
    void ref.current!.send('long task');
    await settle();
    own.send({ type: 'turn_started', turn_id: 't1' });
    own.send({ type: 'done', turn_id: 't1', content: 'Seg one', message_id: 'a1', intermediate: true });
    own.send({ type: 'stream', turn_id: 't1', content: 'Seg two, so far' });
    await settle(10);
  });
  await act(async () => {
    own.fail();
    await settle(10);
  });
  // Segment two closed before the event stream replayed the turn.
  history = [
    { id: 'u1', role: 'user', content: 'long task' },
    { id: 'a1', role: 'assistant', content: 'Seg one' },
    { id: 'a2', role: 'assistant', content: 'Seg two' },
  ];
  const restoresBefore = restores();
  await act(async () => {
    const live = subscriptions[subscriptions.length - 1];
    live.send({ type: 'thinking', turn_id: 't1', resumed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Seg three, so far' });
    await settle(20);
  });
  assert.equal(restores(), restoresBefore + 1, 'the replay reads the conversation back');
  assert.deepEqual(bubbles('long task', 'Seg three, so far'), ['long task', 'a1', 'a2', 'Seg three, so far']);
  await act(async () => {
    subscriptions[subscriptions.length - 1].send({ type: 'done', turn_id: 't1', content: 'Seg three', message_id: 'a3' });
    await settle(10);
  });
  assert.deepEqual(bubbles('long task'), ['long task', 'a1', 'a2', 'a3']);
  assert.deepEqual(heard, ['running', 'answered']);
  await finish(...subscriptions);
});

test('a relayed turn let go of while the page was hidden keeps its closed segments, and its replay reads back the rest in place', async () => {
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const timers = manualTimers([60000]);
  const setVisibility = (state: string) =>
    act(async () => {
      visibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle(10);
    });
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    let history: unknown[] = [];
    const pendingRestores: (() => void)[] = [];
    const restore = (req: RecordedRequest) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (history.length === 0) return json({ conversation_id: 'c1', messages: [] });
      // Slower than the event stream's snapshot.
      return new Promise<Response>((resolve) => pendingRestores.push(() => resolve(json({ conversation_id: 'c1', messages: history }))));
    };
    fakeBackend([agentsRoute, restore, eventsRoute(subscriptions)]);
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } });
    await act(async () => {
      subscriptions[0].send({ type: 'user_message', message: { id: 'u1', role: 'user', content: 'Question' } });
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'done', turn_id: 't1', content: 'Seg one', message_id: 'a1', intermediate: true });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Seg two, so far' });
      await settle(10);
    });
    await setVisibility('hidden');
    await timers.run(60000);
    assert.deepEqual(bubbles(), ['u1', 'a1'], 'the segment being written goes, the closed one stays');
    history = [
      { id: 'u1', role: 'user', content: 'Question' },
      { id: 'a1', role: 'assistant', content: 'Seg one' },
      { id: 'a2', role: 'assistant', content: 'Seg two' },
    ];
    await setVisibility('visible');
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Seg three, so far' });
      await settle(10);
    });
    await act(async () => {
      for (const answer of pendingRestores.splice(0)) answer();
      await settle(20);
    });
    assert.deepEqual(
      bubbles('Seg three, so far'),
      ['u1', 'a1', 'a2', 'Seg three, so far'],
      'the segment closed meanwhile, before the one being written',
    );
    await act(async () => {
      subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Seg three', message_id: 'a3' });
      await settle(10);
    });
    await act(async () => {
      for (const answer of pendingRestores.splice(0)) answer();
      await settle(20);
    });
    assert.deepEqual(bubbles(), ['u1', 'a1', 'a2', 'a3'], 'each once, in order');
    await finish(...subscriptions);
  } finally {
    timers.restore();
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

test('a wait stays on screen through what it reports, and ends on any other status', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { skipWait: '/chat/messages/skip-wait' } }, ref);
  const continueShown = () =>
    !!container.querySelector('button')?.ownerDocument && [...container.querySelectorAll('button')].some((b) => b.textContent === 'Continue now');
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'status', status: 'wait_start', seconds: 30, reason: 'Waiting for the sandbox' });
    await settle(10);
  });
  assert.ok(continueShown());
  await act(async () => {
    stream.send({ type: 'status', status: 'wait_status', tool: 'wait', items: [{ id: 'x', status: 'done' }] });
    stream.send({ type: 'status', status: 'tool_progress', tool: 'wait', event: 'output' });
    stream.send({ type: 'status', status: 'consult_progress', tools: ['Writer'] });
    stream.send({ type: 'status', status: 'tool_heartbeat', tools: ['wait'], elapsed_s: 12 });
    await settle(10);
  });
  assert.ok(text().includes('Waiting for the sandbox'), 'the wait’s label stays');
  assert.ok(continueShown(), 'and so does Continue now');
  await act(async () => {
    stream.send({ type: 'status', status: 'tool_start', tools: ['search'] });
    await settle(10);
  });
  assert.ok(!text().includes('Waiting for the sandbox'));
  assert.ok(!continueShown());
  await finish(stream);
});

test('a steer read back into the turn keeps the words its bubble shows', async () => {
  const timers = manualTimers([1000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    let history: unknown[] = [];
    const restore = (req: RecordedRequest) =>
      req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: history }) : undefined;
    fakeBackend([
      agentsRoute,
      restore,
      eventsRoute(subscriptions),
      (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered', turn_id: 't1' }) : undefined),
    ]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    await act(async () => {
      subscriptions[0].send({ type: 'user_message', message: { id: 'u1', role: 'user', content: 'Question' } });
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'done', turn_id: 't1', content: 'Seg one', message_id: 'a1', intermediate: true });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Seg two, so far' });
      await settle(10);
    });
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = ref.current!.send('Look at the full report', { displayText: 'Report attached' });
      await settle(10);
    });
    assert.equal(await outcome, 'steered');
    await finish(subscriptions[0]);
    history = [
      { id: 'u1', role: 'user', content: 'Question' },
      { id: 'a1', role: 'assistant', content: 'Seg one' },
      { id: 'u2', role: 'user', content: 'Look at the full report' },
    ];
    await timers.run(1000);
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Seg two, more' });
      await settle(20);
    });
    assert.ok(text().includes('Report attached'), 'the bubble keeps its words');
    assert.ok(!text().includes('Look at the full report'));
    assert.ok(container.querySelector('[data-message-id="u2"]'), 'and takes the stored id');
    await finish(...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a relayed turn winding down holds sends across its event stream’s reopening, until its stored end', async () => {
  const timers = manualTimers([1000, 5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const own = sseStream();
    const requests = fakeBackend([
      agentsRoute,
      restoreRoute(),
      eventsRoute(subscriptions),
      (req) => (req.url === '/api/chat/messages' ? own.response() : undefined),
    ]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    await act(async () => {
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Partial' });
      subscriptions[0].send({ type: 'cancelled', turn_id: 't1' });
      await settle(10);
    });
    await finish(subscriptions[0]);
    await act(async () => {
      void ref.current!.send('mine');
      await settle(10);
    });
    assert.equal(sent(requests, '/api/chat/messages').length, 0, 'still held: the closed stream said nothing of the turn');
    await timers.run(1000);
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      await settle(10);
    });
    assert.equal(sent(requests, '/api/chat/messages').length, 0, 'the replay of the turn winding down holds it too');
    await act(async () => {
      subscriptions[1].send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
      await settle(20);
    });
    assert.equal(sent(requests, '/api/chat/messages').length, 1, 'sent on the stored end');
    assert.ok(container.querySelector('[data-message-id="m1"]'));
    await finish(own, ...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a steer no turn will answer stays, with a notice that the next message carries it', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'stored', turn_id: null, answered: false }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    streams[0].send({ type: 'stream', content: 'Working' });
    await settle(10);
  });
  let outcome!: Promise<unknown>;
  await act(async () => {
    outcome = ref.current!.send('one more thing');
    await settle(10);
  });
  assert.equal(await outcome, 'steered');
  assert.ok(text().includes('one more thing'), 'the bubble stays');
  assert.equal(notice(), 'This message will be read with your next one.');
  await act(async () => {
    streams[0].send({ type: 'done', content: 'Working, done' });
    streams[0].close();
    await settle(10);
  });
  assert.equal(notice(), 'This message will be read with your next one.', 'past the turn’s end');
  await act(async () => {
    void ref.current!.send('next');
    await settle(10);
  });
  assert.equal(notice(), null, 'until the next send');
  await finish(...streams);
});

test('the stored end of a relayed turn naming none lands while the own turn runs', async () => {
  const timers = manualTimers([5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const own = sseStream();
    fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions), (req) => (req.url === '/api/chat/messages' ? own.response() : undefined)]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    await act(async () => {
      subscriptions[0].send({ type: 'thinking' });
      subscriptions[0].send({ type: 'stream', content: 'Halfway' });
      subscriptions[0].send({ type: 'cancelled' });
      await settle(10);
    });
    await act(async () => {
      void ref.current!.send('mine');
      await settle(10);
    });
    await timers.run(5000);
    await act(async () => {
      own.send({ type: 'turn_started', turn_id: 't2' });
      own.send({ type: 'stream', turn_id: 't2', content: 'Own answer' });
      await settle(10);
    });
    await act(async () => {
      subscriptions[0].send({ type: 'cancelled', message_id: 'm4' });
      await settle(10);
    });
    assert.ok(container.querySelector('[data-message-id="m4"]'), 'the stopped answer takes its stored id');
    assert.ok(text().includes('Own answer'));
    await finish(own, ...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a late stored end leaves the running turn’s context gauge and agent alone', async () => {
  const timers = manualTimers([5000]);
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const own = sseStream();
    fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions), (req) => (req.url === '/api/chat/messages' ? own.response() : undefined)]);
    const ref = createRef<Handle>();
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
    const gauge = () => container.querySelector('[aria-label$="%)"]')?.getAttribute('aria-label') ?? '';
    await act(async () => {
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'error', turn_id: 't1', content: 'boom' });
      await settle(10);
    });
    await act(async () => {
      void ref.current!.send('mine');
      await settle(10);
    });
    await timers.run(5000);
    await act(async () => {
      own.send({ type: 'turn_started', turn_id: 't2' });
      own.send({ type: 'status', status: 'thinking', context_tokens: 50000, context_window: 200000 });
      await settle(10);
    });
    assert.ok(gauge().includes('(25%)'), gauge());
    await act(async () => {
      subscriptions[0].send({
        type: 'done',
        turn_id: 't1',
        content: 'boom',
        message_id: 'm1',
        context_tokens: 180000,
        context_window: 200000,
        transfer_agent_id: 'x9',
        transfer_agent_name: 'Escalation Desk',
      });
      await settle(10);
    });
    assert.ok(container.querySelector('[data-message-id="m1"]'));
    assert.ok(gauge().includes('(25%)'), gauge());
    assert.ok(!text().includes('Escalation Desk'));
    await finish(own, ...subscriptions);
  } finally {
    timers.restore();
  }
});

test('a message held behind a relayed turn let go of while the page was hidden waits for that turn’s end, which the host hears only then', async () => {
  for (const replayed of [true, false]) {
    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    const timers = manualTimers([60000, 5000]);
    const setVisibility = (state: string) =>
      act(async () => {
        visibility = state;
        document.dispatchEvent(new Event('visibilitychange'));
        await settle(10);
      });
    try {
      const subscriptions: ReturnType<typeof sseStream>[] = [];
      const own = sseStream();
      const requests = fakeBackend([
        agentsRoute,
        restoreRoute(),
        eventsRoute(subscriptions),
        (req) => (req.url === '/api/chat/messages' ? own.response() : undefined),
      ]);
      const ref = createRef<Handle>();
      const asked: string[] = [];
      const { heard, onTurnRunningChange } = turnLog();
      await render(
        {
          conversationId: 'c1',
          holdSendsDuringTurn: true,
          apiEndpoints: { events: '/chat/conversations' },
          onTurnRunningChange,
          onBeforeSend: (draft) => {
            asked.push(`${draft.text}:${draft.turnRunning ? 'running' : 'idle'}`);
          },
        },
        ref,
      );
      await act(async () => {
        subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
        subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Working' });
        await settle(10);
      });
      let outcome!: Promise<unknown>;
      await act(async () => {
        outcome = ref.current!.send('scoped', { extras: { scope: 'kb' } });
        await settle(10);
      });
      assert.equal(await outcome, 'held');
      await setVisibility('hidden');
      await timers.run(60000);
      assert.equal(sent(requests, '/api/chat/messages').length, 0, 'still held: the turn may run on');
      assert.deepEqual(heard, ['running'], 'and the host is not told it ended');
      await setVisibility('visible');
      if (replayed) {
        await act(async () => {
          subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
          subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Working, more' });
          await settle(10);
        });
        assert.equal(sent(requests, '/api/chat/messages').length, 0, 'held through the replay');
        assert.deepEqual(heard, ['running']);
        await act(async () => {
          subscriptions[1].send({ type: 'done', turn_id: 't1', content: 'Working, more', message_id: 'm1' });
          await settle(20);
        });
      } else {
        // Not replayed: it ended while the stream was away.
        await timers.run(5000);
      }
      const body = sent(requests, '/api/chat/messages')[0]?.body as Record<string, unknown> | undefined;
      assert.equal(body?.content, 'scoped', `sent once the turn is over (${replayed ? 'replayed' : 'not replayed'})`);
      assert.equal(body?.scope, 'kb');
      assert.deepEqual(asked, ['scoped:running', 'scoped:idle'], 'asked again, the turn over');
      assert.deepEqual(heard, ['running', replayed ? 'answered' : 'stopped', 'running']);
      await finish(own, ...subscriptions);
      await unmount();
    } finally {
      timers.restore();
      delete (document as unknown as Record<string, unknown>).visibilityState;
    }
  }
});

test('Stop on a relayed turn let go of while the page was hidden stops it there, its replay unseen', async () => {
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const timers = manualTimers([60000, 5000]);
  const setVisibility = (state: string) =>
    act(async () => {
      visibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle(10);
    });
  try {
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const requests = fakeBackend([
      agentsRoute,
      restoreRoute(),
      eventsRoute(subscriptions),
      (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'cancelled', turn: 'local' }, 202) : undefined),
    ]);
    const ref = createRef<Handle>();
    const settled: string[] = [];
    const { heard, onTurnRunningChange } = turnLog();
    await render(
      {
        conversationId: 'c1',
        holdSendsDuringTurn: true,
        apiEndpoints: { events: '/chat/conversations', cancel: '/chat/messages/cancel' },
        onTurnRunningChange,
        onHeldSendSettled: (held, outcome) => settled.push(`${held}:${outcome}`),
      },
      ref,
    );
    await act(async () => {
      subscriptions[0].send({ type: 'thinking', turn_id: 't1' });
      subscriptions[0].send({ type: 'stream', turn_id: 't1', content: 'Working' });
      await settle(10);
    });
    await act(async () => {
      void ref.current!.send('scoped', { extras: { scope: 'kb' } });
      await settle(10);
    });
    await setVisibility('hidden');
    await timers.run(60000);
    await setVisibility('visible');
    await act(async () => {
      ref.current!.stop();
      await settle(10);
    });
    assert.equal(sent(requests, '/api/chat/messages/cancel').length, 1, 'the backend is told');
    assert.deepEqual(heard, ['running', 'stopped']);
    assert.deepEqual(settled, ['scoped:dropped']);
    await act(async () => {
      subscriptions[1].send({ type: 'thinking', turn_id: 't1', resumed: true });
      subscriptions[1].send({ type: 'stream', turn_id: 't1', content: 'Working, more' });
      await settle(10);
    });
    assert.ok(!text().includes('Working, more'), 'its replay is not shown');
    assert.deepEqual(heard, ['running', 'stopped']);
    assert.equal(sent(requests, '/api/chat/messages').length, 0);
    await finish(...subscriptions);
  } finally {
    timers.restore();
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

test('messages held across a turn and its wind-down go out together, each as the send hook decides it with the turn over', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined)]);
  const ref = createRef<Handle>();
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { steer: null, cancel: '/chat/messages/cancel' },
      onBeforeSend: (draft) => ({ text: `${draft.turnRunning ? 'R' : 'I'}:${draft.text}` }),
    },
    ref,
  );
  const contents = () => sent(requests, '/api/chat/messages').map((r) => (r.body as { content: string }).content);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    streams[0].send({ type: 'turn_started', turn_id: 't1' });
    await settle(10);
  });
  await act(async () => {
    void ref.current!.send('a');
    await settle(10);
  });
  // A provisional end: the turn is over, and winds down.
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1' });
    await settle(10);
  });
  await act(async () => {
    void ref.current!.send('b');
    await settle(10);
  });
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
    await settle(20);
  });
  assert.deepEqual(contents(), ['I:first', 'I:a\n\nI:b']);
  await finish(...streams);
});

test('a steer refused from the composer gives back what the user typed, not what the send hook made of it', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ detail: 'Too long to steer' }, 422) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', onBeforeSend: (draft) => ({ text: `[ctx] ${draft.text}` }) }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('hello');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send now"]')!.click();
    await settle(10);
  });
  assert.equal(notice(), 'Too long to steer');
  assert.equal(container.querySelector('textarea')!.value, 'hello');
  await finish(stream);
});
