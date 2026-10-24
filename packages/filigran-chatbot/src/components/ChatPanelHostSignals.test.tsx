/**
 * Rendering tests of what the panel tells a host so it never re-derives it -
 * `yarn test`: a turn's end and a replay on `onStreamEvent`, the end of the
 * user's session, whether a message slot draws a streaming answer, the
 * backend's own fields of each message, and where the waiting game leads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream } from '../../test/dom.ts';
import { agentsRoute, container, eventsRoute, finish, mountPanels, restoreRoute, type Handle, type Props } from '../../test/panel.tsx';

const { waitingGameUrl } = await import('./ChatWaitingPanel.tsx');
type Info = import('../types.ts').ChatStreamEventInfo;
type Message = import('../types.ts').ChatMessage;

const { render, unmount } = mountPanels();
const sessionExpired = (reason?: string) => json({ detail: { code: 'session_expired', ...(reason ? { reason } : {}) } }, 401);

test('onStreamEvent says which frame ends a turn, provisionally or stored, and which acknowledges a replay', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), eventsRoute(subscriptions), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const heard: string[] = [];
  const onStreamEvent = (frame: Record<string, unknown>, info: Info) =>
    heard.push(`${String(frame.type)}:${info.relayed ? 'relayed' : 'own'}:${info.end ?? '-'}:${info.replayed ? 'replayed' : '-'}`);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' }, onStreamEvent }, ref);
  const live = subscriptions[0];

  await act(async () => {
    live.send({ type: 'thinking', turn_id: 't1', resumed: true, elapsed_s: 3, relayed: true });
    live.send({ type: 'stream', turn_id: 't1', content: 'Partial', relayed: true });
    live.send({ type: 'error', turn_id: 't1', content: 'Boom', relayed: true, provisional: true });
    await settle(10);
  });
  await act(async () => {
    live.send({ type: 'done', turn_id: 't1', content: 'Boom', message_id: 'm1', relayed: true });
    await settle(10);
  });
  assert.deepEqual(heard, ['thinking:relayed:-:replayed', 'stream:relayed:-:-', 'error:relayed:provisional:-', 'done:relayed:stored:-']);

  heard.length = 0;
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'stream', content: 'One' });
    stream.send({ type: 'done', content: 'One', intermediate: true, message_id: 'm2' });
    stream.send({ type: 'done', content: 'Two', message_id: 'm3' });
    await settle(10);
  });
  assert.deepEqual(heard, ['stream:own:-:-', 'done:own:-:-', 'done:own:stored:-'], 'an intermediate done ends nothing');
  await finish(stream, ...subscriptions);
});

test('onSessionEnded is told once, from either stream, and again once the credentials change', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const stream = sseStream();
  fakeBackend([
    (req) => (req.url === '/api/chat/agents' && req.headers.authorization === 'Bearer fresh' ? sessionExpired('lifetime') : undefined),
    agentsRoute,
    restoreRoute(),
    eventsRoute(subscriptions),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const heard: (string | undefined)[] = [];
  const ref = createRef<Handle>();
  const props: Partial<Props> = {
    conversationId: 'c1',
    apiEndpoints: { events: '/chat/conversations' },
    onSessionEnded: (reason) => heard.push(reason),
    requestHeaders: { Authorization: 'Bearer stale' },
  };
  await render(props, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'session_expired', reason: 'idle' });
    await settle(10);
  });
  await act(async () => {
    subscriptions[0].send({ type: 'session_expired', reason: 'idle' });
    await settle(10);
  });
  assert.deepEqual(heard, ['idle'], 'once, whichever stream says it');

  // New credentials, refused in turn by the first request made with them.
  await render({ ...props, requestHeaders: { Authorization: 'Bearer fresh' } });
  await act(async () => settle(10));
  assert.deepEqual(heard, ['idle', 'lifetime']);
  await finish(stream, ...subscriptions);
});

test('a 401 saying the session ended on a read-back reaches the host; another 401 does not', async () => {
  const heard: (string | undefined)[] = [];
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? sessionExpired() : undefined)]);
  await render({ conversationId: 'c1', onSessionEnded: (reason) => heard.push(reason) });
  assert.deepEqual(heard, [undefined], 'no reason given, none made up');
  assert.ok(container.querySelector('button')?.textContent, 'the panel still shows itself');

  await unmount();
  const heardAgain: (string | undefined)[] = [];
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ detail: 'Not authenticated' }, 401) : undefined),
  ]);
  await render({ conversationId: 'c1', onSessionEnded: (reason) => heardAgain.push(reason) });
  assert.deepEqual(heardAgain, []);
});

test('the message slots are told whether the answer they draw is still streaming', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm1', role: 'assistant', content: 'Restored' }]),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const renderMessageExtras = (message: Message, { streaming }: { streaming: boolean }) => (
    <span data-testid="slot">{`${message.content}|${streaming ? 'streaming' : 'done'}`}</span>
  );
  const shown = () => [...container.querySelectorAll('[data-testid="slot"]')].map((e) => e.textContent);
  const footer: string[] = [];
  const ref = createRef<Handle>();
  await render(
    {
      conversationId: 'c1',
      renderMessageExtras,
      messageFooterActions: (message, { streaming }) => {
        footer.push(`${message.content}|${streaming}`);
        return null;
      },
    },
    ref,
  );
  await act(async () => {
    void ref.current!.send('go');
    await settle();
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'Partial' });
    await settle(10);
  });
  assert.deepEqual(shown(), ['Restored|done', 'go|done', 'Partial|streaming']);
  await act(async () => {
    stream.send({ type: 'done', content: 'Partial, then all', message_id: 'm2' });
    await settle(10);
  });
  await finish(stream);
  assert.deepEqual(shown(), ['Restored|done', 'go|done', 'Partial, then all|done']);
  assert.ok(footer.includes('Partial, then all|false'));
  assert.ok(!footer.some((f) => f.endsWith('|true')), 'a footer shows on a finished answer only');
});

test('each message carries the backend’s own fields: restored, paged, live, and from a stored end', async () => {
  const subscriptions: ReturnType<typeof sseStream>[] = [];
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm3', role: 'assistant', content: 'Restored', llm_trace_id: 'tr-3', channel: 'teams' }], { has_more: true }),
    (req) =>
      req.url.startsWith('/api/chat/sessions/c1/messages?')
        ? json({ messages: [{ id: 'm1', role: 'user', content: 'Paged', channel: 'slack' }], has_more: false })
        : undefined,
    eventsRoute(subscriptions),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  // By text, as last drawn: the thread shows only its latest messages once paged.
  const raw = new Map<string, string>();
  const renderMessageExtras = (m: Message) => {
    raw.set(m.content, m.raw ? String(m.raw.llm_trace_id ?? m.raw.channel) : 'none');
    return null;
  };
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { messagesPage: '/chat/sessions', events: '/chat/conversations' }, renderMessageExtras }, ref);
  await act(async () => {
    [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Load earlier messages')!.click();
    await settle();
  });
  await act(async () => {
    void ref.current!.send('go');
    await settle();
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'Live' });
    stream.send({ type: 'done', content: 'Live', message_id: 'm4', llm_trace_id: 'tr-4' });
    await settle(10);
  });
  await finish(stream);
  // A relayed turn ended provisionally: its stored end describes the answer.
  await act(async () => {
    subscriptions[0].send({ type: 'thinking', turn_id: 't9', relayed: true });
    subscriptions[0].send({ type: 'stream', turn_id: 't9', content: 'Stopped', relayed: true });
    subscriptions[0].send({ type: 'cancelled', turn_id: 't9', relayed: true, provisional: true });
    await settle(10);
  });
  await act(async () => {
    subscriptions[0].send({ type: 'cancelled', turn_id: 't9', message_id: 'm9', llm_trace_id: 'tr-9', relayed: true });
    await settle(10);
  });
  assert.deepEqual(Object.fromEntries(raw), { Paged: 'slack', Restored: 'tr-3', go: 'none', Live: 'tr-4', Stopped: 'tr-9' });
  await finish(...subscriptions);
});

test('the waiting game leads where the host says, else to XTM One’s arcade, and only somewhere safe', () => {
  assert.equal(waitingGameUrl('https://xtm.example.com/'), 'https://xtm.example.com/chat?arcade=play');
  assert.equal(waitingGameUrl('https://xtm.example.com', 'https://games.example.com/play'), 'https://games.example.com/play');
  assert.equal(waitingGameUrl(undefined, ' /chat?arcade=play '), '/chat?arcade=play', 'a path of the host’s own origin');
  assert.equal(waitingGameUrl('https://xtm.example.com', 'javascript:alert(1)'), null, 'never falls back once the host named one');
  assert.equal(waitingGameUrl(undefined, '//evil.example.com'), null);
  assert.equal(waitingGameUrl(undefined, '/\\evil.example.com'), null);
  assert.equal(waitingGameUrl('ftp://xtm.example.com'), null);
});
