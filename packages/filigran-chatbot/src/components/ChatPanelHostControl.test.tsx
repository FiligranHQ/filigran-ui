/**
 * Rendering tests of what a host relies on when it drives the panel - `yarn
 * test`: steering named to the backend, host cards replacing built-in ones,
 * readiness, the send hook and the words a bubble shows, the trace a stopped
 * answer leaves, reloading the agents and the conversation, `onTurnRunningChange` for own,
 * relayed and handed-over turns, and `getDraft`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef, StrictMode, useEffect, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { fakeBackend, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import { AGENTS, agentsRoute, BASE_PROPS, container, eventsRoute, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';

const { render, unmount } = mountPanels({ ...BASE_PROPS, onClose: () => undefined, onModeChange: () => undefined });

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

test("a composer send before the agents land waits for them, and leaves with the host's agent", async () => {
  let releaseAgents!: () => void;
  const agentsReady = new Promise<void>((resolve) => (releaseAgents = resolve));
  const stream = sseStream();
  const requests = fakeBackend([
    async (req) => {
      if (req.url !== '/api/chat/agents') return undefined;
      await agentsReady;
      return json([{ id: 'a0', name: 'Default Agent', slug: 'default', icon: null, description: null }, ...AGENTS]);
    },
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1' }) : undefined),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  // With a cancel route the conversation is created before the message goes.
  await render({ initialAgent: 'hunter', apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  await act(async () => {
    ref.current!.setDraft('hello');
    await settle();
  });
  // Pressed twice while waiting: still one message.
  for (let press = 0; press < 2; press += 1) {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
      await settle();
    });
  }
  const isSession = (r: RecordedRequest) => r.url === '/api/chat/sessions' && r.method === 'POST';
  assert.equal(requests.filter((r) => isSession(r) || r.url === '/api/chat/messages').length, 0, 'nothing leaves before the agent is chosen');
  await act(async () => {
    releaseAgents();
    await settle(10);
  });
  const session = requests.find(isSession);
  const sent = requests.filter((r) => r.url === '/api/chat/messages');
  assert.equal(sent.length, 1);
  const message = sent[0];
  assert.equal((session?.body as { agent_slug?: string })?.agent_slug, 'hunter');
  assert.equal((message?.body as { agent_slug?: string })?.agent_slug, 'hunter');
  assert.equal((message?.body as { content?: string })?.content, 'hello');
  assert.equal(container.querySelector('textarea')!.value, '');
  await finish(stream);
});

/** A backend whose agents and read-back of `c1` each answer once released. */
function heldAgentsAndHistory(more: ((req: RecordedRequest) => Response | Promise<Response> | undefined)[]) {
  let releaseAgents!: () => void;
  let releaseHistory!: () => void;
  const agentsReady = new Promise<void>((resolve) => (releaseAgents = resolve));
  const historyReady = new Promise<void>((resolve) => (releaseHistory = resolve));
  const requests = fakeBackend([
    async (req) => {
      if (req.url !== '/api/chat/agents') return undefined;
      await agentsReady;
      return json([{ id: 'a0', name: 'Default Agent', slug: 'default', icon: null, description: null }, ...AGENTS]);
    },
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      await historyReady;
      return json({ conversation_id: 'c1', messages: [] });
    },
    ...more,
  ]);
  return { requests, releaseAgents, releaseHistory };
}

const typeAndSend = async (ref: React.RefObject<Handle | null>, value: string) => {
  await act(async () => {
    ref.current!.setDraft(value);
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle();
  });
};

test('a composer send waiting for the agents does not wait for the history read back after them', async () => {
  const stream = sseStream();
  const { requests, releaseAgents, releaseHistory } = heldAgentsAndHistory([
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ initialAgent: 'hunter', conversationId: 'c1' }, ref);
  await typeAndSend(ref, 'hello');
  await act(async () => {
    releaseAgents();
    await settle(10);
  });
  assert.ok(
    requests.some((r) => r.url === '/api/chat/sessions' && r.method === 'POST'),
    'the read-back is under way',
  );
  const sent = requests.filter((r) => r.url === '/api/chat/messages');
  assert.equal(sent.length, 1, 'the message left while the history is still read back');
  assert.equal((sent[0].body as { agent_slug?: string }).agent_slug, 'hunter');
  await act(async () => {
    releaseHistory();
    await settle(10);
  });
  await finish(stream);
});

test('a file still uploading when the agents land lets go of the waiting send, the draft kept', async () => {
  let uploaded!: () => void;
  const stream = sseStream();
  const { requests, releaseAgents, releaseHistory } = heldAgentsAndHistory([
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) =>
      req.url === '/api/chat/upload' ? new Promise<Response>((resolve) => (uploaded = () => resolve(json({ file_ids: ['f1'] })))) : undefined,
  ]);
  const ref = createRef<Handle>();
  await render({ initialAgent: 'hunter', conversationId: 'c1' }, ref);
  await act(async () => releaseHistory());
  await typeAndSend(ref, 'hello');
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await act(async () => {
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(10);
  });
  await act(async () => {
    releaseAgents();
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/messages').length, 0, 'not sent without its file');
  assert.equal(container.querySelector('textarea')!.value, 'hello');
  assert.ok(text().includes('report.pdf'));
  await act(async () => {
    uploaded();
    await settle(10);
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle(10);
  });
  const sent = requests.filter((r) => r.url === '/api/chat/messages');
  assert.equal(sent.length, 1);
  assert.deepEqual((sent[0].body as { file_ids?: string[] }).file_ids, ['f1']);
  assert.equal((sent[0].body as { agent_slug?: string }).agent_slug, 'hunter');
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

test('a steer sent as the answer streams keeps the text it was sent with, and its echo is shown once', async () => {
  const turn = sseStream();
  const events = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered' }) : undefined),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined),
  ]);
  // Presses "Send now" as the answer's first words commit, before that
  // commit's passive effects run: the send lands while the panel's effects
  // still see the thread without its bubble.
  let pressed = false;
  function SteerOnCommit() {
    useLayoutEffect(() => {
      if (pressed) return;
      pressed = true;
      container.querySelector<HTMLButtonElement>('button[aria-label="Send now"]')!.click();
    });
    return null;
  }
  const ref = createRef<Handle>();
  await render(
    {
      conversationId: 'c1',
      apiEndpoints: { events: '/chat/conversations' },
      onBeforeSend: ({ text: typed }) => ({ text: `[Page: Report 42]\n\n${typed}`, displayText: typed }),
      renderMessageExtras: (message, { streaming }) => (streaming && message.content ? <SteerOnCommit /> : null),
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    ref.current!.setDraft('Shorter');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'stream', content: 'Answer so far' });
    await settle();
  });
  assert.ok(pressed);
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm9', role: 'user', content: '[Page: Report 42]\n\nShorter' } });
    await settle();
  });
  const bubbles = [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((b) => b.textContent);
  assert.deepEqual(bubbles, ['first', 'Shorter']);
  assert.ok(container.querySelector('[data-message-id="m9"]'), 'the bubble takes the stored id');
  await finish(turn, events);
});

/** The thread as shown, top to bottom: `user:` or `assistant:` and each message's text. */
function threadOrder(): string[] {
  return [...container.querySelectorAll('[data-testid="filigran-chat-user-message"], [data-testid="filigran-chat-assistant-message"]')].map(
    (e) => `${e.getAttribute('data-testid') === 'filigran-chat-user-message' ? 'user' : 'assistant'}: ${e.textContent?.trim() ?? ''}`,
  );
}

test('a message sent while the answer is written shows above that answer, where the backend stores it', async () => {
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered', turn_id: 't1' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'turn_started', turn_id: 't1' });
    turn.send({ type: 'stream', content: 'Looking' });
    await settle();
  });
  await act(async () => {
    void ref.current!.send('and also');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'stream', content: ' into both' });
    turn.send({ type: 'done', content: 'Looking into both', message_id: 'a1' });
    await settle();
  });
  assert.deepEqual(threadOrder(), ['user: first', 'user: and also', 'assistant: Looking into both']);
  await finish(turn);
});

test('a message sent between two segments of the answer shows after the first one', async () => {
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered', turn_id: 't1' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('first');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'turn_started', turn_id: 't1' });
    turn.send({ type: 'stream', content: 'Part one' });
    turn.send({ type: 'done', content: 'Part one', intermediate: true });
    await settle();
  });
  await act(async () => {
    void ref.current!.send('and also');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'stream', content: 'Part two' });
    turn.send({ type: 'done', content: 'Part two' });
    await settle();
  });
  assert.deepEqual(threadOrder(), ['user: first', 'assistant: Part one', 'user: and also', 'assistant: Part two']);
  await finish(turn);
});

test("another tab's message, relayed while a relayed answer is written, shows above that answer", async () => {
  const events = sseStream();
  fakeBackend([agentsRoute, restoreRoute([]), (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm1', role: 'user', content: 'first' } });
    events.send({ type: 'thinking', turn_id: 't9' });
    events.send({ type: 'stream', turn_id: 't9', content: 'Looking' });
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm2', role: 'user', content: 'and also' } });
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'done', turn_id: 't9', content: 'Looking into both', message_id: 'a1' });
    await settle(10);
  });
  assert.deepEqual(threadOrder(), ['user: first', 'user: and also', 'assistant: Looking into both']);
  await finish(events);
});

test("another tab's message relayed in the same tick as the answer's end still shows above that answer", async () => {
  const events = sseStream();
  fakeBackend([agentsRoute, restoreRoute([]), (req) => (req.url.startsWith('/api/chat/conversations/c1/events') ? events.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } }, ref);
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm1', role: 'user', content: 'first' } });
    events.send({ type: 'thinking', turn_id: 't9' });
    events.send({ type: 'stream', turn_id: 't9', content: 'Looking' });
    await settle(10);
  });
  // No render between the two: the update placing the message runs after the turn ended.
  await act(async () => {
    events.send({ type: 'user_message', message: { id: 'm2', role: 'user', content: 'and also' } });
    events.send({ type: 'done', turn_id: 't9', content: 'Looking into both', message_id: 'a1' });
    await settle(10);
  });
  assert.deepEqual(threadOrder(), ['user: first', 'user: and also', 'assistant: Looking into both']);
  await finish(events);
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

test('reloading the conversation shows what the host changed in it, and keeps the draft', async () => {
  const stored: unknown[] = [
    { id: 'm1', role: 'user', content: 'Draft the deck' },
    { id: 'a1', role: 'assistant', content: 'Here is the outline' },
  ];
  const requests = fakeBackend([agentsRoute, restoreRoute(stored)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  assert.ok(text().includes('Here is the outline'));
  const sessions = () => requests.filter((r) => r.url === '/api/chat/sessions').length;
  const opened = sessions();
  act(() => ref.current!.setDraft('and the speaker notes'));
  // The host changed the conversation outside the panel: another agent took it over.
  stored.push({ id: 'a2', role: 'assistant', content: 'Continued by Deck Bot on 2026-10-30.' });
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle();
  });
  assert.equal(sessions(), opened, 'selecting the conversation on screen reads nothing');
  assert.ok(!text().includes('Continued by Deck Bot'));
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  assert.equal(sessions(), opened + 1);
  assert.ok(text().includes('Here is the outline'));
  assert.ok(text().includes('Continued by Deck Bot on 2026-10-30.'));
  assert.equal(ref.current!.getDraft(), 'and the speaker notes');
});

test('a reload asked during a turn reads nothing until the turn ends, then keeps its answer', async () => {
  const stored: unknown[] = [
    { id: 'm1', role: 'user', content: 'Draft the deck' },
    { id: 'a1', role: 'assistant', content: 'Here is the outline' },
  ];
  const turn = sseStream();
  const requests = fakeBackend([agentsRoute, restoreRoute(stored), (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  const sessions = () => requests.filter((r) => r.url === '/api/chat/sessions').length;
  const opened = sessions();
  await act(async () => {
    void ref.current!.send('add a slide');
    await settle();
  });
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  assert.equal(sessions(), opened, 'nothing is read while the turn runs');
  stored.push(
    { id: 'm2', role: 'user', content: 'add a slide' },
    { id: 'a2', role: 'assistant', content: 'Slide added' },
    { id: 'a3', role: 'assistant', content: 'Continued by Deck Bot on 2026-10-30.' },
  );
  await act(async () => {
    turn.send({ type: 'done', content: 'Slide added', message_id: 'a2' });
    turn.close();
    await settle(10);
  });
  assert.ok(sessions() > opened, 'read once the turn ended');
  const answers = [...container.querySelectorAll('[data-testid="filigran-chat-assistant-message"]')].map((e) => e.textContent ?? '');
  assert.equal(answers.filter((a) => a.includes('Slide added')).length, 1, answers.join(' | '));
  assert.ok(text().includes('Continued by Deck Bot on 2026-10-30.'));
});

test("the conversation's agent read back replaces the one a turn transferred it to", async () => {
  const session: Record<string, unknown> = { conversation_id: 'c1', messages: [], agent_name: 'Hunter' };
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' ? json(session) : undefined),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('escalate');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'done', content: 'Handing over', message_id: 'a2', transfer_agent_id: 'x9', transfer_agent_name: 'Escalation Desk' });
    turn.close();
    await settle(10);
  });
  assert.ok(text().includes('Escalation Desk'));
  // The host handed the conversation to another agent.
  session.agent_name = 'Deck Bot';
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.ok(!text().includes('Escalation Desk'), 'the transfer the turn reported is forgotten');
  assert.ok(text().includes('Deck Bot'));
});

test('a reload that fails leaves the thread, its draft and its conversation', async () => {
  let failing = false;
  const stored = [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }];
  const requests = fakeBackend([
    agentsRoute,
    (req) =>
      req.url === '/api/chat/sessions' ? (failing ? json({ detail: 'boom' }, 500) : json({ conversation_id: 'c1', messages: stored })) : undefined,
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  const sessions = () => requests.filter((r) => r.url === '/api/chat/sessions').length;
  const opened = sessions();
  act(() => ref.current!.setDraft('and the speaker notes'));
  failing = true;
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.equal(sessions(), opened + 1);
  assert.deepEqual(changes, [], 'the conversation is kept');
  assert.ok(text().includes('Here is the outline'));
  assert.equal(ref.current!.getDraft(), 'and the speaker notes');
});

test('a reload keeps what only the panel holds: a stopped answer', async () => {
  const turn = sseStream();
  const stored = [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }];
  fakeBackend([agentsRoute, restoreRoute(stored), (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
  });
  await act(async () => {
    ref.current!.stop();
    turn.close();
    await settle();
  });
  assert.ok(text().includes('Stopped'));
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.ok(text().includes('Here is the outline'));
  const asked = [...container.querySelectorAll('[data-testid="filigran-chat-user-message"]')].map((e) => e.textContent);
  assert.deepEqual(asked, ['go']);
  assert.ok(text().includes('Stopped'));
});

test('a reload whose backend is down and then gone keeps the thread and the conversation', async () => {
  const statuses: number[] = [];
  const stored = [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }];
  fakeBackend([
    agentsRoute,
    (req) =>
      req.url === '/api/chat/sessions'
        ? statuses.length
          ? json({ detail: 'boom' }, statuses.shift())
          : json({ conversation_id: 'c1', messages: stored })
        : undefined,
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  statuses.push(503, 500);
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  // The owed read-back is tried again: still the host's.
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.equal(statuses.length, 0, 'both answers were read');
  assert.deepEqual(changes, [], 'the conversation is kept');
  assert.ok(text().includes('Here is the outline'));
});

test("a reload retried after its backend was down is still the host's: merged, and the transfer forgotten", async () => {
  let down = false;
  const session: Record<string, unknown> = {
    conversation_id: 'c1',
    messages: [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }],
    agent_name: 'Hunter',
  };
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' ? (down ? json({ detail: 'down' }, 503) : json(session)) : undefined),
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('escalate');
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'done', content: 'Handing over', transfer_agent_id: 'x9', transfer_agent_name: 'Escalation Desk' });
    turn.close();
    await settle(10);
  });
  assert.ok(text().includes('Escalation Desk'));
  session.agent_name = 'Deck Bot';
  down = true;
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  down = false;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await settle(10);
  });
  assert.ok(text().includes('Handing over'), 'merged: the answer the server does not hold stays');
  assert.ok(!text().includes('Escalation Desk'));
  assert.ok(text().includes('Deck Bot'));
});

test('a reload asked before the agents are listed waits for the open, which still drops a stale conversation', async () => {
  let listAgents!: () => void;
  const agentsListed = new Promise<void>((resolve) => (listAgents = resolve));
  const requests = fakeBackend([
    async (req) => {
      if (req.url !== '/api/chat/agents') return undefined;
      await agentsListed;
      return json(AGENTS);
    },
    (req) => (req.url === '/api/chat/sessions' ? json({ detail: 'Conversation not found' }, 404) : undefined),
  ]);
  const reads = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length;
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  assert.equal(reads(), 0);
  await act(async () => {
    listAgents();
    await settle(10);
  });
  assert.equal(reads(), 1, 'the open alone');
  assert.deepEqual(changes, [null], 'the open is not a host reload: a stale conversation is dropped');
});

test("a reload refreshes the context gauge from the conversation's newest reading", async () => {
  const stored: Record<string, unknown>[] = [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }];
  fakeBackend([agentsRoute, restoreRoute(stored)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  const gauge = () => container.querySelector('[aria-label$="%)"]')?.getAttribute('aria-label') ?? '';
  stored.push({ id: 'a2', role: 'assistant', content: 'Continued by Deck Bot', context_tokens: 50000, context_window: 200000 });
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.ok(gauge().includes('(25%)'), gauge());
});

test('a reload answered with a re-created conversation opens it, in place of the old thread', async () => {
  const session: Record<string, unknown> = {
    conversation_id: 'c1',
    messages: [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }],
  };
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json(session) : undefined)]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  assert.ok(text().includes('Here is the outline'));
  // The backend no longer holds c1 and starts c2, still empty, in its place.
  Object.assign(session, { conversation_id: 'c2', messages: [] });
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.deepEqual(changes, ['c2']);
  assert.ok(!text().includes('Here is the outline'), 'not left under the new conversation');
});

test('a reload asked after the open failed runs that open: a conversation gone since is dropped', async () => {
  const statuses = [503, 404];
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ detail: 'x' }, statuses.shift() ?? 404) : undefined),
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  assert.deepEqual(changes, [], 'a backend down keeps the conversation, owed');
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.equal(statuses.length, 0);
  assert.deepEqual(changes, [null], 'read as the open, not as a host reload of a thread never shown');
});

test("a host read-back a turn overtook keeps the turn's context reading", async () => {
  let readBackHeld: Promise<void> | null = null;
  let releaseReadBack!: () => void;
  const session: Record<string, unknown> = {
    conversation_id: 'c1',
    messages: [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }],
  };
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (readBackHeld) await readBackHeld;
      return json(session);
    },
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  const gauge = () => container.querySelector('[aria-label$="%)"]')?.getAttribute('aria-label') ?? '';
  // Read before the turn: an older reading.
  session.messages = [
    { id: 'a1', role: 'assistant', content: 'Here is the outline' },
    { id: 'a2', role: 'assistant', content: 'Continued by Deck Bot', context_tokens: 10000, context_window: 200000 },
  ];
  readBackHeld = new Promise((resolve) => (releaseReadBack = resolve));
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  // The user sends from the composer while it is in flight.
  act(() => ref.current!.setDraft('go'));
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'status', status: 'thinking', context_tokens: 50000, context_window: 200000 });
    await settle();
  });
  assert.ok(gauge().includes('(25%)'), gauge());
  await act(async () => {
    releaseReadBack();
    await settle();
  });
  await act(async () => {
    turn.send({ type: 'done', content: 'Done', message_id: 'a3' });
    turn.close();
    await settle(10);
  });
  assert.ok(text().includes('Continued by Deck Bot'), 'the read-back was put on screen after the turn');
  assert.ok(gauge().includes('(25%)'), gauge());
});

test('a reload with no agent to read the conversation with is dropped, and the open after it still drops a stale conversation', async () => {
  let list: typeof AGENTS = [];
  const requests = fakeBackend([
    (req) => (req.url === '/api/chat/agents' ? json(list) : undefined),
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ detail: 'Conversation not found' }, 404) : undefined),
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  await act(async () => {
    ref.current!.reloadConversation();
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 0);
  list = [...AGENTS];
  await act(async () => {
    ref.current!.reloadAgents();
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 1);
  assert.deepEqual(changes, [null], 'the open is not a host reload');
});

test("a host reload after the panel's own read-back failed is still the host's", async () => {
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const setVisibility = (state: string) =>
    act(async () => {
      visibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle(10);
    });
  // The event stream closes after a minute hidden: that timer runs on demand.
  const realSetTimeout = window.setTimeout;
  const hiddenCloses: (() => void)[] = [];
  window.setTimeout = ((fn: () => void, ms?: number, ...args: unknown[]) => {
    if (ms !== 60000) return realSetTimeout(fn, ms, ...args);
    hiddenCloses.push(fn);
    return -1;
  }) as typeof window.setTimeout;
  try {
    const statuses: number[] = [];
    const subscriptions: ReturnType<typeof sseStream>[] = [];
    const stored = [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }];
    fakeBackend([
      agentsRoute,
      (req) =>
        req.url === '/api/chat/sessions' && req.method === 'POST'
          ? statuses.length
            ? json({ detail: 'x' }, statuses.shift())
            : json({ conversation_id: 'c1', messages: stored })
          : undefined,
      eventsRoute(subscriptions),
    ]);
    const ref = createRef<Handle>();
    const changes: (string | null)[] = [];
    await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onConversationChange: (id) => changes.push(id) }, ref);
    assert.ok(text().includes('Here is the outline'));
    // Hidden long enough to close the stream; shown again, the panel reads the conversation back: the backend is down.
    statuses.push(503);
    await setVisibility('hidden');
    await act(async () => {
      for (const close of hiddenCloses.splice(0)) close();
      await settle(10);
    });
    await setVisibility('visible');
    assert.equal(statuses.length, 0, "the panel's own read-back was answered 503");
    statuses.push(500);
    await act(async () => {
      ref.current!.reloadConversation();
      await settle(10);
    });
    assert.equal(statuses.length, 0);
    assert.deepEqual(changes, [], 'the thread on screen keeps its conversation');
    assert.ok(text().includes('Here is the outline'));
    await finish(...subscriptions);
  } finally {
    window.setTimeout = realSetTimeout;
    visibility = 'visible';
  }
});

test('a re-created conversation answered behind a turn is switched to all the same, keeping the draft', async () => {
  let readBackHeld: Promise<void> | null = null;
  let releaseReadBack!: () => void;
  const session: Record<string, unknown> = {
    conversation_id: 'c1',
    messages: [{ id: 'a1', role: 'assistant', content: 'Here is the outline' }],
  };
  const turn = sseStream();
  fakeBackend([
    agentsRoute,
    async (req) => {
      if (req.url !== '/api/chat/sessions' || req.method !== 'POST') return undefined;
      if (readBackHeld) await readBackHeld;
      return json(session);
    },
    (req) => (req.url === '/api/chat/messages' ? turn.response() : undefined),
  ]);
  const ref = createRef<Handle>();
  const changes: (string | null)[] = [];
  await render({ conversationId: 'c1', onConversationChange: (id) => changes.push(id) }, ref);
  readBackHeld = new Promise((resolve) => (releaseReadBack = resolve));
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  act(() => ref.current!.setDraft('go'));
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await settle();
  });
  act(() => ref.current!.setDraft('and the notes'));
  Object.assign(session, { conversation_id: 'c2', messages: [] });
  await act(async () => {
    releaseReadBack();
    await settle(10);
  });
  assert.deepEqual(changes, ['c2']);
  assert.ok(!text().includes('Here is the outline'), 'nothing of c1 stays under c2');
  assert.equal(ref.current!.getDraft(), 'and the notes');
  await finish(turn);
});

test('reloading with no conversation on screen reads nothing', async () => {
  const requests = fakeBackend([agentsRoute, restoreRoute([])]);
  const ref = createRef<Handle>();
  await render({ conversationId: null }, ref);
  const sessions = () => requests.filter((r) => r.url === '/api/chat/sessions').length;
  const opened = sessions();
  await act(async () => {
    ref.current!.reloadConversation();
    await settle();
  });
  assert.equal(sessions(), opened);
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
    // The stream closes after it: no stored end is awaited any more.
    await finish(turn);
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
  await unmount();
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

type TurnEnd = import('../types.ts').ChatTurnEnd;

/** What the host heard: `true` as a turn starts, how it ended as it stops. */
function turnLog() {
  const heard: string[] = [];
  const onTurnRunningChange = (running: boolean, info?: TurnEnd) => heard.push(running ? 'running' : (info?.ended ?? 'no outcome'));
  return { heard, onTurnRunningChange };
}

test('the host hears how each turn of its own ended: answered, stopped or failed', async () => {
  const turns = Array.from({ length: 7 }, () => sseStream());
  const refusal: { release?: () => void } = {};
  let next = 0;
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => {
      if (req.url !== '/api/chat/messages') return undefined;
      const index = next++;
      if (index === turns.length) return new Promise<Response>((resolve) => (refusal.release = () => resolve(json({ detail: 'Slow down' }, 429))));
      return turns[index].response();
    },
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', onTurnRunningChange }, ref);

  const cases: [string, Record<string, unknown>[], string][] = [
    [
      'its last done',
      [
        { type: 'done', content: 'Part', intermediate: true },
        { type: 'done', content: 'Whole' },
      ],
      'answered',
    ],
    ['an error', [{ type: 'error', content: 'Boom' }], 'failed'],
    ['a cancelled frame', [{ type: 'cancelled' }], 'stopped'],
    ['a cancelled frame after the last done', [{ type: 'done', content: 'Whole' }, { type: 'cancelled' }], 'stopped'],
    ['the session ending', [{ type: 'session_expired', reason: 'idle' }], 'stopped'],
    ['a stream closed before its last done', [{ type: 'done', content: 'Part', intermediate: true }], 'stopped'],
    [
      'a follow-up pass cut short after the last done',
      [
        { type: 'done', content: 'Whole' },
        { type: 'stream', content: 'And' },
      ],
      'stopped',
    ],
  ];
  for (const [i, [what, frames, ended]] of cases.entries()) {
    await act(async () => {
      void ref.current!.send(`turn ${i}`);
      await settle();
    });
    await act(async () => {
      turns[i].send({ type: 'stream', content: 'Some' });
      for (const frame of frames) turns[i].send(frame);
      turns[i].close();
      await settle(10);
    });
    assert.deepEqual(heard.slice(-2), ['running', ended], `${what}: ${ended}`);
  }

  // A send the backend refuses fails its turn.
  await act(async () => {
    void ref.current!.send('refused');
    await settle();
  });
  assert.equal(heard[heard.length - 1], 'running');
  await act(async () => {
    refusal.release!();
    await settle(10);
  });
  assert.deepEqual(heard.slice(-2), ['running', 'failed']);
  assert.equal(heard.length, 2 * (cases.length + 1));
});

test('the host hears how a relayed turn ended, and a turn handed over to the event stream ends once', async () => {
  const stream = sseStream();
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  fakeBackend([
    agentsRoute,
    restoreRoute([]),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => {
      if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
      const events = sseStream();
      subscriptions.push(events);
      return events.response();
    },
  ]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onTurnRunningChange }, ref);
  const live = () => subscriptions[subscriptions.length - 1];

  for (const [turnId, end, ended] of [
    ['t1', { type: 'done', content: 'Relayed, whole' }, 'answered'],
    ['t2', { type: 'error', content: 'Boom' }, 'failed'],
    ['t3', { type: 'cancelled' }, 'stopped'],
    ['t4', { type: 'session_expired', reason: 'lifetime' }, 'stopped'],
  ] as const) {
    await act(async () => {
      live().send({ type: 'thinking', turn_id: turnId });
      live().send({ type: 'stream', turn_id: turnId, content: 'Relayed' });
      live().send({ type: 'done', turn_id: turnId, content: 'Relayed', intermediate: true });
      await settle(10);
    });
    await act(async () => {
      live().send({ ...end, turn_id: turnId });
      await settle(10);
    });
    assert.deepEqual(heard.slice(-2), ['running', ended], `relayed ${end.type}: ${ended}`);
  }

  // The panel's own stream drops; the event stream replays the turn to its last done.
  await act(async () => {
    void ref.current!.send('long task');
    await settle();
    stream.send({ type: 'turn_started', turn_id: 't5' });
    stream.send({ type: 'stream', turn_id: 't5', content: 'Working' });
    await settle(10);
  });
  await act(async () => {
    stream.fail();
    await settle(10);
  });
  assert.equal(heard[heard.length - 1], 'running', 'a handed-over turn runs on');
  await act(async () => {
    live().send({ type: 'thinking', turn_id: 't5', resumed: true });
    live().send({ type: 'done', turn_id: 't5', content: 'Working, and done' });
    await settle(10);
  });
  assert.deepEqual(heard.slice(-2), ['running', 'answered']);
  assert.equal(heard.length, 10);
  await finish(...subscriptions);
});

test('Stop, a new conversation and unmounting stop the turn, as the host hears it', async () => {
  const turns = [sseStream(), sseStream(), sseStream()];
  let next = 0;
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? turns[next++].response() : undefined)]);
  const ref = createRef<Handle>();
  const { heard, onTurnRunningChange } = turnLog();
  await render({ onTurnRunningChange }, ref);
  const start = async (turn: ReturnType<typeof sseStream>) => {
    await act(async () => {
      void ref.current!.send('go');
      await settle();
      turn.send({ type: 'stream', content: 'Half' });
      await settle(10);
    });
  };

  await start(turns[0]);
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.deepEqual(heard, ['running', 'stopped'], 'Stop');

  await start(turns[1]);
  await act(async () => {
    ref.current!.newConversation();
    await settle(10);
  });
  assert.deepEqual(heard.slice(2), ['running', 'stopped'], 'a new conversation');

  await start(turns[2]);
  await unmount();
  assert.deepEqual(heard.slice(4), ['running', 'stopped'], 'unmounted mid-turn');
  await finish(...turns);
});

test('getDraft reads the composer as it stands, as set or as the panel left it, also from the send hook on a held message', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute([]), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const seenOnHeld: string[] = [];
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { steer: null },
      onBeforeSend: (draft) => {
        if (!draft.held) return undefined;
        seenOnHeld.push(ref.current!.getDraft());
        return false;
      },
    },
    ref,
  );
  assert.equal(ref.current!.getDraft(), '');
  await act(async () => {
    ref.current!.setDraft('set by the host');
    assert.equal(ref.current!.getDraft(), 'set by the host', 'at once');
    await settle();
  });
  assert.equal(container.querySelector('textarea')!.value, 'set by the host');

  await act(async () => {
    void ref.current!.send('first');
    await settle();
    stream.send({ type: 'stream', content: 'Working' });
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send when the answer ends"]')!.click();
    await settle(10);
  });
  assert.equal(ref.current!.getDraft(), '', 'held: the composer is empty');
  await act(async () => {
    ref.current!.setDraft('typed since');
    await settle();
  });
  await act(async () => {
    stream.send({ type: 'done', content: 'ok' });
    stream.close();
    await settle(20);
  });
  assert.deepEqual(seenOnHeld, ['typed since'], 'what the composer held as the hook took the message over');
  assert.equal(ref.current!.getDraft(), 'typed since\n\nset by the host', 'and the held text the panel gave back after it');
});

test('under StrictMode, a send from the host’s mount effect is not dropped by the simulated unmount', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const { ChatPanel } = await import('./ChatPanel.tsx');
  const outcomes: Promise<unknown>[] = [];
  function Host() {
    const ref = useRef<Handle>(null);
    const sentRef = useRef(false);
    useEffect(() => {
      if (sentRef.current) return;
      sentRef.current = true;
      outcomes.push(ref.current!.send('from the mount'));
    }, []);
    return <ChatPanel {...BASE_PROPS} ref={ref} />;
  }
  const strictContainer = document.createElement('div');
  document.body.appendChild(strictContainer);
  const root = createRoot(strictContainer);
  try {
    await act(async () => {
      root.render(
        <StrictMode>
          <Host />
        </StrictMode>,
      );
    });
    await act(async () => settle(10));
    assert.equal(outcomes.length, 1);
    assert.equal(await outcomes[0], 'sent');
    assert.equal(requests.filter((r) => r.url === '/api/chat/messages').length, 1);
    await finish(stream);
  } finally {
    await act(async () => root.unmount());
    strictContainer.remove();
  }
});

test("the host's theme is set on the panel root, where every part of the panel reads it", async () => {
  fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'user', content: 'Hello' }])]);
  await render({ conversationId: 'c1', theme: { surface: 'rgb(1, 2, 3)', userBackground: 'transparent' } });
  const root = container.querySelector<HTMLElement>('[data-testid="filigran-chat-panel"]')!;
  assert.equal(root.style.getPropertyValue('--filigran-chat-surface'), 'rgb(1, 2, 3)');
  assert.equal(root.style.getPropertyValue('--filigran-chat-user-background'), 'transparent');
  assert.equal(root.style.getPropertyValue('--filigran-chat-text'), '', 'an entry not given keeps the panel’s own');
  assert.ok(container.querySelector('[data-testid="filigran-chat-user-message"]')!.classList.contains('chat-user-bubble'));
});
