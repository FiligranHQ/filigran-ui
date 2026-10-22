/**
 * Rendering tests of what a host relies on when it drives the panel - `yarn
 * test`: steering named to the backend, host cards replacing built-in ones,
 * readiness, the send hook, and the trace a stopped answer leaves.
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
const restoreRoute = (messages: unknown[]) => (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages }) : undefined;
const text = () => container.textContent ?? '';
/** Close what a test left open, inside `act`: the panel answers it with updates. */
const finish = (...streams: { close: () => void }[]) =>
  act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });

test('a steer names its tab, and its echo on the event stream is not shown twice', async () => {
  const turn = sseStream();
  const events = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered' }) : undefined),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    ref.current!.send('and also');
    await settle();
  });
  const steer = requests.find((r) => r.url === '/api/chat/messages/steer')!;
  const subscription = requests.find((r) => r.url.includes('/events'))!;
  assert.equal(steer.headers['x-chat-client-id'], subscription.headers['x-chat-client-id']);
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm9', role: 'user', content: 'and also' } });
    await settle();
  });
  const shown = [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((e) => e.textContent);
  assert.deepEqual(shown, ['first', 'and also']);
  await finish(turn, events);
});

test("a host's card for a built-in kind replaces the built-in one, marker or not", async () => {
  fakeBackend([
    agentsRoute,
    restoreRoute([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Deck: [[PRESENTATION:d1#/s2]]',
        artifacts: [
          { kind: 'presentation', id: 'd1', title: 'Q3 threats', downloads: [] },
          { kind: 'report', id: 'r1', title: 'Weekly report', downloads: [] },
        ],
        attachments: [{ file_id: 'f1', filename: 'iocs.csv' }],
      },
    ]),
  ]);
  await render({
    conversationId: 'c1',
    markerRenderers: {
      PRESENTATION: { render: (args) => <span>host deck {args}</span> },
      REPORT: { render: (args) => <span>host report {args}</span> },
      FILE: { render: (args) => <span>host file {args}</span> },
    },
  });
  assert.ok(text().includes('host deck d1#/s2'));
  assert.ok(text().includes('host report r1'), 'an artifact with no marker goes to the host too');
  assert.ok(text().includes('host file f1'));
  assert.ok(!text().includes('Q3 threats'), 'no built-in deck card');
  assert.ok(!text().includes('Weekly report'), 'no built-in report card');
});

test('the handle waits for the panel to be ready, which the host is told', async () => {
  let releaseAgents!: () => void;
  const agentsReady = new Promise<void>((resolve) => (releaseAgents = resolve));
  const stream = sseStream();
  const requests = fakeBackend([
    async (req) => {
      if (req.url !== '/api/chat/agents') return undefined;
      await agentsReady;
      return json(AGENTS);
    },
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  let readyCalls = 0;
  await render({ onReady: () => (readyCalls += 1) }, ref);
  await act(async () => {
    ref.current!.send('hello');
    await settle();
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/messages').length, 0, 'nothing leaves before the agent is chosen');
  assert.equal(readyCalls, 0);
  await act(async () => {
    releaseAgents();
    await settle(10);
  });
  assert.equal(readyCalls, 1);
  const message = requests.find((r) => r.url === '/api/chat/messages');
  assert.equal((message?.body as { agent_slug?: string })?.agent_slug, 'hunter');
  await finish(stream);
});

test('the send hook can take a send over, or reword it and add fields', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const seen: string[] = [];
  await render(
    {
      onBeforeSend: ({ text: draft, source }) => {
        seen.push(`${source}:${draft}`);
        if (draft === 'blocked') return false;
        return { text: draft.toUpperCase(), extras: { mode: 'deep_investigation' } };
      },
    },
    ref,
  );
  await act(async () => {
    ref.current!.send('blocked');
    await settle();
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/messages').length, 0);
  await act(async () => {
    ref.current!.send('apt28');
    await settle();
  });
  const body = requests.find((r) => r.url === '/api/chat/messages')!.body as Record<string, unknown>;
  assert.equal(body.content, 'APT28');
  assert.equal(body.mode, 'deep_investigation');
  assert.deepEqual(seen, ['host:blocked', 'host:apt28']);
  await finish(stream);
});

test('the send hook can show the user other words than it sends, for a new turn and a steer', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ ok: true }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render(
    {
      conversationId: 'c1',
      onBeforeSend: ({ text: typed }) => ({ text: `[Document: Q3 report]\n\n${typed}`, displayText: typed }),
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('Summarize it');
    await settle();
  });
  const body = requests.find((r) => r.url === '/api/chat/messages')!.body as Record<string, unknown>;
  assert.equal(body.content, '[Document: Q3 report]\n\nSummarize it');
  const bubbles = () => [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((b) => b.textContent ?? '');
  assert.ok(bubbles()[0].includes('Summarize it'));
  assert.ok(!text().includes('[Document: Q3 report]'), 'the context is sent, never shown');
  await act(async () => {
    void ref.current!.send('Shorter');
    await settle();
  });
  const steer = requests.find((r) => r.url === '/api/chat/messages/steer')!.body as Record<string, unknown>;
  assert.equal(steer.content, '[Document: Q3 report]\n\nShorter');
  assert.ok(bubbles()[1].includes('Shorter'));
  assert.ok(!text().includes('[Document: Q3 report]'));
  await finish(stream);
});

test('a stopped answer says so, even when nothing was written yet', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => {
    ref.current!.send('go');
    await settle();
  });
  await act(async () => {
    ref.current!.stop();
    await settle();
  });
  assert.ok(text().includes('Stopped'));
  assert.ok(container.querySelector('button[aria-label="Send"]'), 'the send button has a name');
  assert.ok(container.querySelector('button[aria-label="Attach files"]'), 'the attach button has a name');
});

test('reloading the agents picks up new ones and keeps the agent picked', async () => {
  let list = [...AGENTS];
  const requests = fakeBackend([(req) => (req.url === '/api/chat/agents' ? json(list) : undefined)]);
  const ref = createRef<Handle>();
  await render({ initialAgent: 'hunter' }, ref);
  list = [{ id: 'a0', name: 'Fresh Agent', slug: 'fresh', icon: null, description: null }, ...AGENTS];
  await act(async () => {
    ref.current!.reloadAgents();
    await settle();
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/agents').length, 2);
  assert.ok(text().includes('Hunter'), 'still the agent picked, not the first of the new list');
  const picker = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Hunter'))!;
  await act(async () => picker.click());
  assert.ok(document.body.textContent?.includes('Fresh Agent'));
});

test('a reload that finds no agent left picks none', async () => {
  let list: typeof AGENTS = [...AGENTS];
  fakeBackend([(req) => (req.url === '/api/chat/agents' ? json(list) : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  assert.ok(text().includes('Hunter'));
  list = [];
  await act(async () => {
    ref.current!.reloadAgents();
    await settle();
  });
  assert.ok(!text().includes('Hunter'), 'the removed agent is no longer shown as picked');
});

test('a send from the handle can show the user other words than it sends, unless the send hook says otherwise', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => {
    void ref.current!.send('[Page: Report 42]\n\nSummarize', { displayText: 'Summarize', extras: { mode: 'deep' } });
    await settle();
  });
  const sent = requests.filter((r) => r.url === '/api/chat/messages').map((r) => r.body as Record<string, unknown>);
  assert.equal(sent[0].content, '[Page: Report 42]\n\nSummarize');
  assert.equal(sent[0].mode, 'deep');
  const bubbles = () => [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((b) => b.textContent ?? '');
  assert.ok(bubbles()[0].includes('Summarize'));
  assert.ok(!text().includes('[Page: Report 42]'), 'what is sent in place of the words shown is never shown');
  await finish(streams[0]);

  const drafts: string[] = [];
  await render(
    {
      onBeforeSend: ({ text: draft }) => {
        drafts.push(draft);
        return { displayText: 'From the hook' };
      },
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('Context\n\nShorter', { displayText: 'Shorter' });
    await settle();
  });
  assert.deepEqual(drafts, ['Context\n\nShorter'], 'the send hook sees the text sent');
  assert.ok(bubbles()[1].includes('From the hook'), "the send hook's words win");
  await finish(streams[1]);
});

test('the host hears when a turn runs on screen, own or relayed, and when it ends however it ends', async () => {
  const turns = [sseStream(), sseStream(), sseStream(), sseStream()];
  let next = 0;
  const events = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? turns[next++].response() : undefined),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  const seen: boolean[] = [];
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange: (running) => seen.push(running) }, ref);
  assert.deepEqual(seen, [], 'nothing to say before a turn');
  const stopShown = () => !!container.querySelector('button[aria-label="Stop generating"]');

  await act(async () => {
    void ref.current!.send('one');
    await settle();
  });
  assert.deepEqual(seen, [true]);
  await act(async () => {
    turns[0].send({ type: 'stream', content: 'Part' });
    turns[0].send({ type: 'done', content: 'Part', intermediate: true });
    await settle(10);
  });
  assert.deepEqual(seen, [true], 'an intermediate done goes on');
  await act(async () => {
    turns[0].send({ type: 'done', content: 'Whole' });
    turns[0].close();
    await settle(10);
  });
  assert.deepEqual(seen, [true, false], 'the last done ends it');

  // An error, a stop the backend reports and the session's end each end the turn there and then.
  for (const [turn, frame] of [
    [turns[1], { type: 'error', content: 'Boom' }],
    [turns[2], { type: 'cancelled' }],
    [turns[3], { type: 'session_expired', reason: 'idle' }],
  ] as const) {
    await act(async () => {
      void ref.current!.send(`after ${frame.type}`);
      await settle();
    });
    await act(async () => {
      turn.send({ type: 'stream', content: 'Some' });
      turn.send(frame);
      await settle(10);
    });
    assert.deepEqual(seen.slice(-2), [true, false], `${frame.type} ends it`);
    assert.equal(stopShown(), false, `no Stop button after ${frame.type}`);
  }
  assert.equal(seen.length, 8);

  // A turn of another tab, relayed by the event stream.
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't9' });
    events.send({ type: 'stream', turn_id: 't9', content: 'Relayed' });
    events.send({ type: 'done', turn_id: 't9', content: 'Relayed', intermediate: true });
    await settle(10);
  });
  assert.deepEqual(seen.slice(8), [true], 'a relayed turn runs, past its intermediate done');
  await act(async () => {
    events.send({ type: 'done', turn_id: 't9', content: 'Relayed, whole' });
    await settle(10);
  });
  assert.deepEqual(seen.slice(8), [true, false]);
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't10' });
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'session_expired', reason: 'lifetime' });
    await settle(10);
  });
  assert.deepEqual(seen.slice(10), [true, false], 'the session ending ends a relayed turn');
  assert.equal(stopShown(), false);

  // The panel goes away in the middle of one.
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't11' });
    await settle(10);
  });
  assert.deepEqual(seen.slice(12), [true]);
  await act(async () => root.render(<div />));
  assert.deepEqual(seen.slice(12), [true, false], 'unmounted mid-turn, it is over for the host');
  events.close();
});

test('a turn whose stream ends, with no event stream to pick it up, is over for the host', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const seen: boolean[] = [];
  await render({ onTurnRunningChange: (running) => seen.push(running) }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'stream', content: 'Half' });
    await settle(10);
  });
  assert.deepEqual(seen, [true]);
  await finish(stream);
  assert.deepEqual(seen, [true, false]);
});
