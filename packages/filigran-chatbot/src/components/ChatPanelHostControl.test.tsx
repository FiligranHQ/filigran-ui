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
