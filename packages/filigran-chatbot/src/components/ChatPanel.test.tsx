/**
 * Rendering tests of the panel against a scripted backend - `yarn test`:
 * inline mode, a host-owned conversation, read-only, the handle, host extras,
 * Stop on a backend whose turns outlive their stream, and the event stream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import { agentsRoute, BASE_PROPS, container, mountPanels, type Handle } from '../../test/panel.tsx';

const { render } = mountPanels({ ...BASE_PROPS, onClose: () => undefined, onModeChange: () => undefined });

const restoreRoute =
  (messages: unknown[] = []) =>
  (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST'
      ? json({ conversation_id: (req.body as { conversation_id?: string }).conversation_id ?? 'new-conv', messages })
      : undefined;

const sent = (requests: RecordedRequest[], url: string) => requests.filter((r) => r.url === url && r.method === 'POST');

test('inline mode fills its container and has neither view switcher nor close button', async () => {
  fakeBackend([agentsRoute]);
  await render({});
  const panel = container.querySelector('[data-testid="filigran-chat-panel"]')!;
  assert.ok(panel.className.includes('relative'));
  assert.ok(!panel.className.includes('fixed'));
  assert.equal(container.querySelector('button[aria-label="Close"]'), null);
  assert.ok(container.querySelector('textarea'));
});

test('a host-owned conversation is restored, and moving it restores the next one', async () => {
  const requests = fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'user', content: 'restored question' }])]);
  await render({ conversationId: 'c1' });
  assert.deepEqual(
    sent(requests, '/api/chat/sessions').map((r) => (r.body as { conversation_id: string }).conversation_id),
    ['c1'],
  );
  assert.ok(container.textContent?.includes('restored question'));
  await render({ conversationId: 'c2' });
  assert.deepEqual(
    sent(requests, '/api/chat/sessions').map((r) => (r.body as { conversation_id: string }).conversation_id),
    ['c1', 'c2'],
  );
  // Never written to the panel's own storage: the host holds it.
  assert.equal(localStorage.getItem('filigranChatConversationId'), null);
});

test('history is restored without an agent list', async () => {
  const requests = fakeBackend([restoreRoute([{ id: 'm1', role: 'assistant', content: 'from history' }])]);
  await render({ conversationId: 'c1', apiEndpoints: { agents: null } });
  assert.equal(sent(requests, '/api/chat/sessions').length, 1);
  assert.ok(container.textContent?.includes('from history'));
});

test('read-only shows the notice in place of the composer', async () => {
  fakeBackend([agentsRoute]);
  await render({ readOnly: true, readOnlyNotice: 'Shared with you by Bob' });
  assert.equal(container.querySelector('textarea'), null);
  assert.ok(container.textContent?.includes('Shared with you by Bob'));
});

test('the handle sends with per-message extras on top of the host extras, and the new id reaches the host', async () => {
  const stream = sseStream();
  const requests = fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const changes: (string | null)[] = [];
  const ref = createRef<Handle>();
  await render(
    { storageKeyPrefix: 'xtm', getRequestExtras: () => ({ desktop_runner_id: 'r1' }), onConversationChange: (id) => changes.push(id) },
    ref,
  );
  await act(async () => {
    ref.current!.send('hello', { extras: { mode: 'deep_investigation' } });
    await settle();
  });
  const [message] = sent(requests, '/api/chat/messages');
  assert.deepEqual(message.body, {
    desktop_runner_id: 'r1',
    mode: 'deep_investigation',
    content: 'hello',
    conversation_id: null,
    agent_slug: 'hunter',
    supports_artifacts: true,
  });
  await act(async () => {
    stream.send({ type: 'stream', content: 'hi there' });
    stream.send({ type: 'done', content: 'hi there', conversation_id: 'c9', message_id: 'm9' });
    stream.close();
    await settle();
  });
  assert.deepEqual(changes, ['c9']);
  assert.equal(localStorage.getItem('xtm:filigranChatConversationId'), 'c9');
  assert.equal(localStorage.getItem('filigranChatConversationId'), null);
});

test('Stop asks a backend whose turns outlive their stream, and waits for its cancelled frame', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'cancelled' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  await act(async () => {
    ref.current!.send('long task');
    await settle();
    stream.send({ type: 'status', status: 'tool_start', tools: ['search'] });
    await settle();
  });
  await act(async () => {
    ref.current!.stop();
    await settle();
  });
  assert.deepEqual(sent(requests, '/api/chat/messages/cancel')[0]?.body, { conversation_id: 'c1' });
  assert.ok(container.textContent?.includes('Stopping…'));
  await act(async () => {
    stream.send({ type: 'cancelled' });
    stream.close();
    await settle();
  });
  assert.ok(!container.textContent?.includes('Stopping…'));
});

test('a Stop while the first message creates its conversation keeps the turn stopping as the message goes out', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c-new' }) : undefined),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'cancelled' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  // Stopped the moment the conversation exists, before the message leaves.
  await render({ apiEndpoints: { cancel: '/chat/messages/cancel' }, onConversationChange: () => ref.current!.stop() }, ref);
  await act(async () => {
    ref.current!.send('long task');
    await settle();
  });
  assert.deepEqual(sent(requests, '/api/chat/messages/cancel')[0]?.body, { conversation_id: 'c-new', awaiting_send: true });
  assert.equal(sent(requests, '/api/chat/messages').length, 1);
  assert.ok(container.textContent?.includes('Stopping…'));
  await act(async () => {
    stream.send({ type: 'cancelled' });
    stream.close();
    await settle();
  });
  assert.ok(!container.textContent?.includes('Stopping…'));
});

test('the event stream renders a turn started elsewhere, and its own turns are named to the backend', async () => {
  const events = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm1', role: 'user', content: 'asked on another tab' }]),
    (req) => (req.url.startsWith('/api/chat/conversations/c1/events?client_id=') ? events.response() : undefined),
  ]);
  await render({ conversationId: 'c1', apiEndpoints: { events: '/chat/conversations' } });
  const [subscription] = requests.filter((r) => r.url.includes('/events'));
  assert.ok(subscription, 'the event stream is opened once the history is on screen');
  const clientId = new URL(subscription.url, 'http://host.test').searchParams.get('client_id');
  assert.equal(subscription.headers['x-chat-client-id'], clientId);
  await act(async () => {
    events.send({ type: 'thinking', turn_id: 't1', resumed: true, elapsed_s: 3 });
    events.send({ type: 'stream', turn_id: 't1', content: 'relayed answer' });
    await settle(10);
  });
  await act(async () => {
    events.send({ type: 'done', turn_id: 't1', content: 'relayed answer', message_id: 'm2' });
    events.send({ type: 'user_message', message: { id: 'm3', role: 'user', content: 'and a follow-up' } });
    await settle(10);
  });
  assert.ok(container.textContent?.includes('relayed answer'));
  assert.ok(container.textContent?.includes('and a follow-up'));
  events.close();
});
