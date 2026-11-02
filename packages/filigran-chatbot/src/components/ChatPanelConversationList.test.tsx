/**
 * Rendering tests of the conversation list's actions and the header a host
 * shapes - `yarn test`: a move the host confirms, failed actions said, the
 * backend's previews and channels, a conversation written in going first,
 * Clear all's wording, the read-only panel, the header's title, subtitle and
 * agent link, and the agent picker's badges.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, installDom, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import type { ChatConversationSummary, ChatPanelHandle, ChatPanelProps, ChatWorkspace } from '../types.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ChatPanel } = await import('./ChatPanel.tsx');

const AGENTS = [
  { id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null, badges: ['Company'] },
  { id: 'a2', name: 'Scout', slug: 'scout', icon: null, description: null },
];
const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);
const listRoute = (rows: unknown[]) => (req: RecordedRequest) => (req.url === '/api/chat/sessions' && req.method === 'GET' ? json(rows) : undefined);
const restoreRoute = (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'POST'
    ? json({ conversation_id: (req.body as { conversation_id?: string }).conversation_id ?? 'c1', messages: [] })
    : undefined;

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
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

async function render(props: Partial<ChatPanelProps>, ref?: React.Ref<ChatPanelHandle>) {
  await act(async () => {
    root.render(<ChatPanel mode="inline" apiBaseUrl="/api" user={{ firstName: 'Ada' }} {...props} ref={ref} />);
  });
  await act(async () => settle(10));
}

const text = () => container.textContent ?? '';
const buttons = () => [...document.body.querySelectorAll('button')];
const button = (label: string) => buttons().find((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);
const rows = () => [...container.querySelectorAll<HTMLElement>('[role="button"][aria-current]')];
const alertText = () => container.querySelector('[role="alert"]')?.textContent ?? null;
const click = (element: Element | undefined) =>
  act(async () => {
    (element as HTMLElement).click();
    await settle(10);
  });

test('a move the host refuses leaves the conversation where it was; one it agrees to files it', async () => {
  const requests = fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Hunt', workspace_id: null }]),
    (req) => (req.url === '/api/chat/workspaces' && req.method === 'GET' ? json([{ id: 'w1', name: 'Shared hunts', can_manage: true }]) : undefined),
    (req) => (req.method === 'PATCH' ? json({ conversation_id: 'c1', workspace_id: 'w1' }) : undefined),
  ]);
  const asked: [ChatConversationSummary, ChatWorkspace | null][] = [];
  let answer = false;
  await render({
    apiEndpoints: { workspaces: '/chat/workspaces' },
    onBeforeMove: async (conversation, workspace) => {
      asked.push([conversation, workspace]);
      return answer;
    },
  });
  await click(button('Move to workspace'));
  await click(button('Shared hunts'));
  assert.equal(asked.length, 1);
  assert.equal(asked[0][0].conversationId, 'c1');
  assert.equal(asked[0][1]?.id, 'w1');
  assert.equal(requests.filter((r) => r.method === 'PATCH').length, 0, 'nothing moves');
  assert.equal(alertText(), null, 'a refusal is the host’s: nothing to say');

  answer = true;
  await click(button('Move to workspace'));
  await click(button('Shared hunts'));
  assert.deepEqual(requests.find((r) => r.method === 'PATCH')?.body, { workspace_id: 'w1' });
});

test('a failed rename tells the user and the host, and keeps the old title', async () => {
  fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Old title' }]),
    (req) => (req.method === 'PATCH' ? json({ detail: 'Titles are locked here' }, 403) : undefined),
  ]);
  const failures: unknown[][] = [];
  await render({ onConversationActionFailed: (...args) => void failures.push(args) });
  await click(button('Rename conversation'));
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Conversation title"]')!;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'New title');
  await act(async () => {
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(10);
  });
  assert.ok(rows()[0].textContent?.includes('Old title'));
  assert.ok(!text().includes('New title'));
  assert.equal(alertText(), 'Titles are locked here');
  assert.equal(failures.length, 1);
  assert.equal(failures[0][0], 'rename');
  assert.equal((failures[0][1] as ChatConversationSummary).conversationId, 'c1');
  assert.equal(failures[0][2], 'Titles are locked here');
});

const failingDelete = () =>
  fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Keep me' }]),
    (req) => (req.method === 'DELETE' ? new Response('boom', { status: 500 }) : undefined),
  ]);

test('a failed delete says so, in its own words when the backend gives none, and tells the host', async () => {
  failingDelete();
  const failures: unknown[][] = [];
  await render({ onConversationActionFailed: (...args) => void failures.push(args) });
  await click(button('Delete conversation'));
  assert.equal(alertText(), 'The conversation could not be deleted');
  assert.equal(failures.length, 1);
  assert.deepEqual([failures[0][0], (failures[0][1] as ChatConversationSummary).conversationId, failures[0][2]], ['delete', 'c1', null]);
  assert.ok(text().includes('Keep me'));
});

test('a failed delete the host told the user of is not said again', async () => {
  failingDelete();
  await render({ onConversationActionFailed: () => true });
  await click(button('Delete conversation'));
  assert.equal(alertText(), null);
});

test('with Clear all named an archive, it says so, and its failure is said under the header when there is no list', async () => {
  fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'One' }]),
    (req) => (req.method === 'DELETE' ? new Response(null, { status: 500 }) : undefined),
  ]);
  await render({ hideConversationList: true, clearAllAction: 'archive', apiEndpoints: { clearAll: '/chat/sessions' } });
  await click(button('Conversation history'));
  assert.ok(button('Archive all conversations'), 'offered as an archive');
  await click(button('Archive all conversations'));
  assert.ok(document.body.textContent?.includes('Archive all conversations?'));
  const confirm = buttons().filter((b) => b.getAttribute('aria-label') === 'Archive all conversations');
  await click(confirm[0]);
  assert.equal(alertText(), 'The conversations could not be archived');
});

test("a row shows the backend's preview and channel, and a backend without them gets the rows it had", async () => {
  fakeBackend([
    agentsRoute,
    listRoute([
      { conversation_id: 'c1', title: 'From Slack', last_message_preview: 'Here are the IOCs', channel: 'slack' },
      { conversation_id: 'c2', title: 'Bare' },
    ]),
  ]);
  await render({});
  const [slack, bare] = rows();
  assert.ok(slack.textContent?.includes('Here are the IOCs'));
  assert.ok(slack.querySelector('[aria-label="Started in Slack"]'));
  assert.equal(bare.textContent, 'Bare');
});

test('a message sent in an older conversation moves it to the top at once, before the turn ends', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    listRoute([
      { conversation_id: 'c2', title: 'Newer', updated_at: '2026-11-02T09:00:00Z' },
      { conversation_id: 'c1', title: 'Older', updated_at: '2026-10-01T09:00:00Z', last_message_preview: 'old words' },
    ]),
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<ChatPanelHandle>();
  await render({ conversationId: 'c1' }, ref);
  assert.ok(rows()[0].textContent?.startsWith('Newer'));
  await act(async () => {
    ref.current!.send('what changed since?');
    await settle(10);
  });
  const first = rows()[0];
  assert.ok(first.textContent?.startsWith('Older'), first.textContent ?? '');
  assert.ok(first.textContent?.includes('what changed since?'));
  assert.ok(!first.textContent?.includes('old words'));
  await act(async () => {
    stream.send({ type: 'done', content: 'ok', conversation_id: 'c1' });
    stream.close();
    await settle(10);
  });
});

test('a read-only panel offers no suggestions heading, and no new conversation', async () => {
  fakeBackend([agentsRoute, listRoute([{ conversation_id: 'c1', title: 'One' }])]);
  await render({ readOnly: true, readOnlyNotice: 'Shared with you to read' });
  assert.ok(text().includes('How can'), 'the welcome screen');
  assert.ok(!text().includes('Suggestions'));
  const sidebarNew = buttons().find((b) => b.textContent === 'New conversation');
  assert.equal(sidebarNew?.disabled, true);
  assert.equal(button('New chat')?.disabled, true);
});

test('the header shows the title and subtitle the host draws from the conversation, and links the agent', async () => {
  fakeBackend([agentsRoute, listRoute([{ conversation_id: 'c1', title: 'Hunting APT28', channel: 'slack' }]), restoreRoute]);
  const clicked: string[] = [];
  await render({
    conversationId: 'c1',
    headerTitle: ({ conversation }) => conversation?.title,
    headerSubtitle: ({ agent, conversation }) => `${agent?.name} · ${conversation?.channel}`,
    agentHref: (agent) => `/agents/${agent.id}`,
    onAgentNameClick: (agent) => void clicked.push(agent.id),
  });
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-title"]')?.textContent, 'Hunting APT28');
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-subtitle"]')?.textContent, 'Hunter · slack');
  const link = container.querySelector<HTMLAnchorElement>('a[href="/agents/a1"]');
  assert.ok(link, 'the agent name is a link');
  assert.equal(link.textContent, 'Hunter');
  await act(async () => {
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
  });
  assert.deepEqual(clicked, ['a1']);
  await click(button('Switch to another agent'));
  assert.ok(document.body.textContent?.includes('Scout'), 'the chevron opens the picker');
});

test('an agent address that is not http(s) or a path links nothing, and no option keeps the header as it was', async () => {
  fakeBackend([agentsRoute]);
  await render({ agentHref: () => 'javascript:alert(1)' });
  assert.equal(container.querySelector('a'), null);
  assert.equal(button('Switch to another agent'), undefined);
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-title"]'), null);
});

test("the agent picker shows an agent's badges, and none for an agent without", async () => {
  fakeBackend([agentsRoute]);
  await render({});
  await click(buttons().find((b) => b.textContent?.includes('Hunter')));
  // The picker's rows, after the header's own button.
  const pickerRow = (name: string) =>
    buttons()
      .filter((b) => b.textContent?.startsWith(name))
      .pop();
  assert.equal(pickerRow('Hunter')?.textContent, 'HunterCompany');
  assert.equal(pickerRow('Scout')?.textContent, 'Scout');
});
