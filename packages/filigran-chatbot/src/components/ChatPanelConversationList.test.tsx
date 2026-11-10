/**
 * Rendering tests of the conversation list's actions and the header a host
 * shapes - `yarn test`: a move the host confirms, failed actions said, a list
 * that could not be read, the backend's previews and channels, a conversation
 * written in going first, Clear all's wording, the read-only panel, the
 * header's title, subtitle and agent link, a new conversation outside the
 * workspaces, and the agent picker's badges and agents not meant for chat.
 */
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, installDom, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import type { ChatConversationSummary, ChatPanelHandle, ChatPanelProps, ChatWorkspace } from '../types.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ChatPanel } = await import('./ChatPanel.tsx');

const AGENTS = [
  { id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null, badges: ['Company', ' Company ', 3, ''] },
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
  // The workspace groups are read with the Workspaces line open, as for a user who opened it once.
  localStorage.setItem('filigran-chat-workspaces-open', '1');
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

test('a workspace group the user opened stays open when the list is hidden and shown again', async () => {
  fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Hunt', workspace_id: 'w1' }]),
    (req) => (req.url === '/api/chat/workspaces' && req.method === 'GET' ? json([{ id: 'w1', name: 'Shared hunts', can_manage: true }]) : undefined),
  ]);
  // The host gives its seed once and keeps passing it, as a host that only reads the profile at load does.
  const reported: string[][] = [];
  const props = {
    apiEndpoints: { workspaces: '/chat/workspaces' },
    expandedWorkspaceGroups: [] as string[],
    onExpandedWorkspaceGroupsChange: (keys: string[]) => void reported.push(keys),
  };
  await render(props);
  const header = () => [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.includes('Shared hunts'));
  assert.equal(header()?.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(reported, [], 'the host is told of its own seed');
  await click(header());
  assert.equal(header()?.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(reported, [['w1']], 'the host is not told of the group opened');
  await render({ ...props, hideConversationList: true });
  await render({ ...props, hideConversationList: false });
  assert.equal(header()?.getAttribute('aria-expanded'), 'true', 'the list shown again collapsed the group the user opened');
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
      { conversation_id: 'c1', title: 'From Slack', last_message_preview: 'Here are the IOCs', channel: 'slack', agent_icon: ' 🛰️ ' },
      { conversation_id: 'c2', title: 'Bare' },
    ]),
  ]);
  await render({});
  const [slack, bare] = rows();
  assert.ok(slack.textContent?.includes('Here are the IOCs'));
  assert.ok(slack.querySelector('[aria-label="Started in Slack"]'));
  assert.equal(slack.querySelector('[data-agent-icon="emoji"]')?.textContent, '🛰️', "the backend's agent_icon, trimmed");
  assert.equal(bare.textContent, 'Bare');
  assert.equal(bare.querySelector('[data-agent-icon]'), null);
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

test('a message steering the running turn moves its conversation up too, with its words', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    listRoute([
      { conversation_id: 'c2', title: 'Newer', updated_at: '2026-11-02T09:00:00Z' },
      { conversation_id: 'c1', title: 'Older', updated_at: '2026-10-01T09:00:00Z' },
    ]),
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered', turn_id: 't1' }) : undefined),
  ]);
  const ref = createRef<ChatPanelHandle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    ref.current!.send('what changed since?');
    await settle(10);
  });
  await act(async () => {
    stream.send({ type: 'status', status: 'thinking', conversation_id: 'c1' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.send('and the lateral movement?');
    await settle(10);
  });
  const first = rows()[0];
  assert.ok(first.textContent?.startsWith('Older'), first.textContent ?? '');
  assert.ok(first.textContent?.includes('and the lateral movement?'), first.textContent ?? '');
  await act(async () => {
    stream.send({ type: 'done', content: 'ok', conversation_id: 'c1' });
    stream.close();
    await settle(10);
  });
});

test('a failure said while the list is hidden shows under the header', async () => {
  let fail!: () => void;
  const deleted = new Promise<Response>((resolve) => {
    fail = () => resolve(new Response('boom', { status: 500 }));
  });
  fakeBackend([agentsRoute, listRoute([{ conversation_id: 'c1', title: 'Keep me' }]), (req) => (req.method === 'DELETE' ? deleted : undefined)]);
  await render({});
  await click(button('Delete conversation'));
  await click(button('Hide conversations'));
  await act(async () => {
    fail();
    await settle(10);
  });
  assert.equal(alertText(), 'The conversation could not be deleted');
});

test('a read-only panel offers no suggestions heading, and still a new conversation: read-only is the conversation’s', async () => {
  fakeBackend([agentsRoute, listRoute([{ conversation_id: 'c1', title: 'One' }])]);
  await render({ readOnly: true, readOnlyNotice: 'Shared with you to read' });
  assert.ok(text().includes('How can'), 'the welcome screen');
  assert.ok(!text().includes('Suggestions'));
  const sidebarNew = buttons().find((b) => b.textContent === 'New conversation');
  assert.equal(sidebarNew?.disabled, false);
  assert.equal(button('New chat')?.disabled, false);
});

test('a new conversation is a short empty state: the greeting, never the agent description, and no suggestion the agent does not serve', async () => {
  const description = 'Assistant of the fleet and its orchestrator, with a description that runs to twenty lines in the agent picker.';
  fakeBackend([
    (req) => (req.url === '/api/chat/agents' ? json([{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description }]) : undefined),
    listRoute([]),
  ]);
  await render({});
  assert.ok(text().includes('Hunter'), 'the greeting names the agent');
  assert.ok(!text().includes(description), 'the description stays in the picker');
  assert.equal(container.querySelector('[role="group"][aria-label="Suggestions"]'), null, 'no generic suggestion');
  assert.ok(!text().includes('simulation scenario'));
});

test('the agent own suggestions show as chips on the empty state', async () => {
  fakeBackend([
    agentsRoute,
    listRoute([]),
    (req) => (req.url.startsWith('/api/chat/suggestions') ? json({ suggestions: ['Hunt APT28 in the last week', 'Triage new alerts'] }) : undefined),
  ]);
  await render({});
  const group = container.querySelector('[role="group"][aria-label="Suggestions"]');
  assert.ok(group, 'the suggestions group');
  assert.deepEqual(
    [...group!.querySelectorAll('button')].map((b) => b.textContent),
    ['Hunt APT28 in the last week', 'Triage new alerts'],
  );
});

test('the header shows the title and subtitle the host draws from the conversation, and its switcher links the agent page', async () => {
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
  assert.equal(container.querySelector('a[href="/agents/a1"]'), null, 'the agent name is no longer a link');
  const switcher = container.querySelector<HTMLButtonElement>('[data-testid="filigran-chat-agent-switcher"]');
  assert.ok(switcher, 'one control for the agent');
  assert.ok(switcher.textContent?.includes('Hunter'));
  await click(switcher);
  assert.equal(switcher.getAttribute('aria-expanded'), 'true');
  assert.ok(document.body.textContent?.includes('Scout'), 'a click on the name opens the switcher');
  assert.deepEqual(clicked, [], 'the switcher click never opens the agent page');
  const link = document.body.querySelector<HTMLAnchorElement>('a[href="/agents/a1"]');
  assert.ok(link, 'the agent page is an item of the menu');
  assert.equal(link.textContent, 'Open agent page');
  await act(async () => {
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
  });
  assert.deepEqual(clicked, ['a1']);
  assert.equal(switcher.getAttribute('aria-expanded'), 'false', 'the menu closes');
});

test('the agent switcher filters as you type, walks with the arrow keys and switches on Enter', async () => {
  fakeBackend([agentsRoute]);
  const changed: string[] = [];
  await render({ onAgentChange: (agent) => void changed.push(agent.name) });
  const switcher = container.querySelector<HTMLButtonElement>('[data-testid="filigran-chat-agent-switcher"]')!;
  await click(switcher);
  const search = document.body.querySelector<HTMLInputElement>('input[role="combobox"]');
  assert.ok(search, 'searchable, whatever the number of agents');
  const options = () => [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent);
  assert.ok(options().some((o) => o?.startsWith('Hunter')));
  assert.ok(options().some((o) => o?.startsWith('Scout')));
  const current = document.body.querySelector('[role="option"][aria-selected="true"]');
  assert.ok(current?.textContent?.startsWith('Hunter'), 'the current agent is marked');
  const type = async (value: string) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(search, value);
      search.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
    });
  const key = async (k: string) =>
    act(async () => {
      search.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      await settle();
    });
  await type('sco');
  assert.deepEqual(
    options().map((o) => o?.slice(0, 5)),
    ['Scout'],
    'typing filters',
  );
  await type('');
  await key('ArrowDown');
  const active = document.body.querySelector('[role="option"][data-active="true"]');
  assert.ok(active && !active.textContent?.startsWith('Hunter'), 'the arrow key moves off the current agent');
  const target = active.textContent!;
  await key('Enter');
  assert.equal(changed.length, 1, 'Enter switches');
  assert.ok(target.startsWith(changed[0]), `${target} / ${changed[0]}`);
});

test('a restored conversation whose agent is not in the list links no agent, never the one picked', async () => {
  fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Old hunt' }]),
    (req) =>
      req.url === '/api/chat/sessions' && req.method === 'POST'
        ? json({ conversation_id: 'c1', agent_name: 'Retired Bot', messages: [] })
        : undefined,
  ]);
  const subtitles: (string | null)[] = [];
  await render({
    conversationId: 'c1',
    agentHref: (agent) => `/agents/${agent.id}`,
    headerSubtitle: ({ agent }) => {
      subtitles.push(agent?.name ?? null);
      return null;
    },
  });
  assert.equal(container.querySelector('a[href^="/agents/"]'), null, 'no agent link');
  assert.equal(subtitles.at(-1), null, 'the subtitle is given no agent');
});

test('an agent path that leaves the origin once the browser drops its tab links nothing', async () => {
  fakeBackend([agentsRoute]);
  await render({ agentHref: () => '/\t/evil.example' });
  assert.equal(container.querySelector('a'), null);
});

test('a header title or subtitle that throws takes only itself down', async () => {
  fakeBackend([agentsRoute]);
  const original = console.error;
  console.error = () => undefined;
  try {
    await render({
      headerTitle: () => {
        throw new Error('boom');
      },
      headerSubtitle: () => {
        throw new Error('boom');
      },
    });
  } finally {
    console.error = original;
  }
  assert.ok(text().includes('Hunter'), 'the panel is still there');
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-title"]'), null);
});

test('a message the backend refuses leaves its conversation where it was', async () => {
  const list = listRoute([
    { conversation_id: 'c2', title: 'Newer' },
    { conversation_id: 'c1', title: 'Older', last_message_preview: 'old words' },
  ]);
  let reads = 0;
  fakeBackend([
    agentsRoute,
    // Read once: the read-back at the turn's end would put the rows back where the backend has them.
    (req) => {
      const answer = list(req);
      if (!answer) return undefined;
      reads += 1;
      return reads === 1 ? answer : new Promise<Response>(() => undefined);
    },
    restoreRoute,
    (req) => (req.url === '/api/chat/messages' ? json({ detail: 'Quota reached' }, 429) : undefined),
  ]);
  const ref = createRef<ChatPanelHandle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('never sent');
    await settle(10);
  });
  assert.ok(rows()[0].textContent?.startsWith('Newer'));
  assert.ok(rows()[1].textContent?.includes('old words'));
});

test('the same failure said again stays for its own time', async () => {
  failingDelete();
  await render({});
  // Timers are the test's here: the request settles through I/O turns.
  const flush = () =>
    act(async () => {
      for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
    });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await act(async () => button('Delete conversation')!.click());
    await flush();
    assert.equal(alertText(), 'The conversation could not be deleted');
    mock.timers.tick(4000);
    await act(async () => button('Delete conversation')!.click());
    await flush();
    mock.timers.tick(4000);
    await flush();
    assert.equal(alertText(), 'The conversation could not be deleted', 'said 4 s ago: still there');
    mock.timers.tick(2500);
    await flush();
    assert.equal(alertText(), null);
  } finally {
    mock.timers.reset();
  }
});

test("the agent's link follows a new agentHref from the host, as when its language changes", async () => {
  fakeBackend([agentsRoute]);
  await render({ agentHref: (agent) => `/en/agents/${agent.id}` });
  await click(container.querySelector<HTMLButtonElement>('[data-testid="filigran-chat-agent-switcher"]') ?? undefined);
  assert.ok(document.body.querySelector('a[href="/en/agents/a1"]'));
  await render({ agentHref: (agent) => `/fr/agents/${agent.id}` });
  const link = () => document.body.querySelector('[data-testid="filigran-chat-agent-page-link"]');
  assert.equal(link()?.getAttribute('href'), '/fr/agents/a1');
});

test('an agent address that is not http(s) or a path links nothing, and no option keeps the header as it was', async () => {
  fakeBackend([agentsRoute]);
  await render({ agentHref: () => 'javascript:alert(1)' });
  assert.equal(container.querySelector('a'), null);
  await click(container.querySelector<HTMLButtonElement>('[data-testid="filigran-chat-agent-switcher"]') ?? undefined);
  assert.equal(button('Open agent page'), undefined, 'no agent page item');
  assert.equal(document.body.querySelector('[data-testid="filigran-chat-agent-page-link"]'), null);
  await click(container.querySelector<HTMLButtonElement>('[data-testid="filigran-chat-agent-switcher"]') ?? undefined);
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-title"]'), null);
});

test("the agent picker shows an agent's badges, each once and strings only, and none for an agent without", async () => {
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

test("without a subtitle of the host's, the header names the channel a conversation was started in, and nothing for one it does not name", async () => {
  fakeBackend([
    agentsRoute,
    listRoute([
      { conversation_id: 'c1', title: 'From Slack', channel: 'slack' },
      { conversation_id: 'c2', title: 'From the web', channel: 'web' },
      { conversation_id: 'c3', title: 'Bare' },
    ]),
    restoreRoute,
  ]);
  const subtitle = () => container.querySelector('[data-testid="filigran-chat-header-subtitle"]')?.textContent ?? null;
  await render({ conversationId: 'c1' });
  assert.equal(subtitle(), 'Agent · Slack');
  await render({ conversationId: 'c2' });
  assert.equal(subtitle(), null, "the panel's own channel");
  await render({ conversationId: 'c3' });
  assert.equal(subtitle(), null, 'a backend that sends no channel');
  await render({ conversationId: 'c1', channelLabel: () => 'Slack DM' });
  assert.equal(subtitle(), 'Agent · Slack DM', "the host's name for it");
  await render({ conversationId: 'c1', channelLabel: () => null });
  assert.equal(subtitle(), null, 'a channel the host hides');
  await render({ conversationId: 'c1', channelLabel: undefined, headerSubtitle: null });
  assert.equal(subtitle(), null, "the host's own subtitle, none, wins");
});

test('the list starts a conversation outside the workspaces, after one was about to start in a workspace', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    listRoute([{ conversation_id: 'c1', title: 'Hunt', workspace_id: 'w1' }]),
    (req) => (req.url === '/api/chat/workspaces' && req.method === 'GET' ? json([{ id: 'w1', name: 'Shared hunts', can_manage: true }]) : undefined),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
  ]);
  const ref = createRef<ChatPanelHandle>();
  // No steering: a host that steers has the conversation created before the send, outside a workspace too.
  await render({ apiEndpoints: { workspaces: '/chat/workspaces', steer: null } }, ref);
  await click(button('New conversation in this workspace'));
  assert.ok(text().includes('New conversation — send a message to start it'), 'about to start in the workspace');
  await click(button('New conversation outside a workspace'));
  assert.ok(!text().includes('New conversation — send a message to start it'), 'no longer');
  await act(async () => {
    ref.current!.send('hello');
    await settle(10);
  });
  // A conversation of a workspace is created first; one of none comes with its first message.
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'POST').length, 0, 'none created in the workspace');
  const sent = requests.find((r) => r.url === '/api/chat/messages');
  assert.ok(sent, 'the message goes');
  assert.ok(!(sent.body as { conversation_id?: string }).conversation_id, JSON.stringify(sent.body));
  await act(async () => {
    stream.send({ type: 'done', content: 'ok', conversation_id: 'c2' });
    stream.close();
    await settle(10);
  });
});

test('a list without workspaces offers no New conversation outside a workspace', async () => {
  fakeBackend([agentsRoute, listRoute([{ conversation_id: 'c1', title: 'Hunt' }])]);
  await render({});
  assert.equal(button('New conversation outside a workspace'), undefined);
  assert.ok(button('New conversation'));
});

test('an agent not meant for chat is said so in the picker and warned of in the composer, and stays selectable', async () => {
  fakeBackend([
    (req) =>
      req.url === '/api/chat/agents'
        ? json([
            { id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null },
            { id: 'a2', name: 'Reporter', slug: 'reporter', icon: null, description: null, disable_chat: true },
            { id: 'a3', name: 'Scout', slug: 'scout', icon: null, description: null, disable_chat: false },
          ])
        : undefined,
  ]);
  await render({});
  // A boolean: a failed assertion on a DOM node takes minutes to print.
  const warning = () => !!container.querySelector('[data-testid="filigran-chat-agent-not-for-chat"]');
  assert.equal(warning(), false, 'the agent picked first is meant for chat');
  await click(buttons().find((b) => b.textContent?.includes('Hunter')));
  const pickerRow = (name: string) =>
    buttons()
      .filter((b) => b.textContent?.startsWith(name))
      .pop();
  assert.equal(pickerRow('Reporter')?.textContent, 'ReporterNot recommended for chat');
  assert.equal(pickerRow('Scout')?.textContent, 'Scout');
  await click(pickerRow('Reporter'));
  assert.ok(
    buttons().some((b) => b.textContent === 'Reporter'),
    'selected',
  );
  assert.equal(
    container.querySelector('[data-testid="filigran-chat-agent-not-for-chat"]')?.textContent,
    'This agent is designed for assignments, not direct chat. It may not respond well to conversational interactions.',
  );
  await click(buttons().find((b) => b.textContent === 'Reporter'));
  await click(pickerRow('Scout'));
  assert.equal(warning(), false);
});

test('the header names the channel a restore reports, before the list is read', async () => {
  const requests = fakeBackend([
    agentsRoute,
    listRoute([]),
    (req) =>
      req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', channel: 'teams', messages: [] }) : undefined,
  ]);
  await render({ mode: 'floating', conversationId: 'c1' });
  assert.equal(requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'GET').length, 0, 'the list is not read');
  assert.equal(container.querySelector('[data-testid="filigran-chat-header-subtitle"]')?.textContent, 'Agent · Teams');
});

test('a restored conversation whose agent is not in the list warns of no agent, never of the one picked', async () => {
  fakeBackend([
    (req) =>
      req.url === '/api/chat/agents'
        ? json([{ id: 'a2', name: 'Reporter', slug: 'reporter', icon: null, description: null, disable_chat: true }])
        : undefined,
    listRoute([{ conversation_id: 'c1', title: 'Old hunt' }]),
    (req) =>
      req.url === '/api/chat/sessions' && req.method === 'POST'
        ? json({ conversation_id: 'c1', agent_name: 'Retired Bot', messages: [] })
        : undefined,
  ]);
  // A boolean: a failed assertion on a DOM node takes minutes to print.
  const warning = () => !!container.querySelector('[data-testid="filigran-chat-agent-not-for-chat"]');
  await render({});
  assert.ok(warning(), 'the picked agent is not meant for chat');
  await render({ conversationId: 'c1' });
  assert.equal(warning(), false, "the conversation's own agent is unknown");
});

/** The list route answering what *answer* gives for each read. */
const listReads = (answer: () => Response | Promise<Response>) => (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'GET' ? answer() : undefined;
const listError = () => container.querySelector('[data-testid="filigran-chat-conversation-list-error"]');

test('a list that could not be read says so, never that there is none, and Retry reads it again', async () => {
  let answer: () => Response = () => new Response('boom', { status: 500 });
  fakeBackend([agentsRoute, listReads(() => answer())]);
  await render({});
  assert.equal(listError()?.textContent, 'Could not load your conversations.Retry');
  assert.ok(!text().includes('No conversations yet'), text());

  answer = () => json([{ conversation_id: 'c1', title: 'Back again' }]);
  await click(button('Retry'));
  assert.equal(listError(), null);
  assert.ok(rows()[0].textContent?.includes('Back again'));
});

test('a list read that cannot reach the backend, or is refused, says so too', async () => {
  for (const answer of [() => Promise.reject(new TypeError('Failed to fetch')), () => json({ detail: 'Not allowed' }, 403)]) {
    fakeBackend([agentsRoute, listReads(answer)]);
    await render({});
    assert.ok(listError(), text());
    await act(async () => root.unmount());
    root = createRoot(container);
  }
});

test('a backend without the list route still shows an empty list', async () => {
  for (const status of [404, 405]) {
    fakeBackend([agentsRoute, listReads(() => new Response(null, { status }))]);
    await render({});
    assert.equal(listError(), null, String(status));
    assert.ok(text().includes('No conversations yet'), text());
    await act(async () => root.unmount());
    root = createRoot(container);
  }
});

test('a read that fails once the list was read keeps its conversations', async () => {
  let answer: () => Response = () => json([{ conversation_id: 'c1', title: 'Still here' }]);
  const requests = fakeBackend([agentsRoute, restoreRoute, listReads(() => answer())]);
  const reads = () => requests.filter((r) => r.url === '/api/chat/sessions' && r.method === 'GET').length;
  await render({});
  const before = reads();
  answer = () => new Response('boom', { status: 503 });
  await render({ conversationId: 'c1' });
  assert.ok(reads() > before, 'read again');
  assert.equal(listError(), null);
  assert.ok(rows()[0].textContent?.includes('Still here'));
});

test("a read refused once the list was read drops its conversations: they may be another account's", async () => {
  for (const status of [401, 403]) {
    let answer: () => Response = () => json([{ conversation_id: 'c1', title: 'Earlier account' }]);
    fakeBackend([agentsRoute, restoreRoute, listReads(() => answer())]);
    await render({});
    assert.ok(rows()[0].textContent?.includes('Earlier account'), String(status));
    answer = () => json({ detail: 'Not signed in' }, status);
    await render({ conversationId: 'c1' });
    assert.ok(!text().includes('Earlier account'), `${status}: the refused read left the previous list`);
    assert.ok(listError(), `${status}: the refusal is not said`);
    await act(async () => root.unmount());
    root = createRoot(container);
  }
});

test('the workspaces of a list that could not be read give way to the failure', async () => {
  fakeBackend([
    agentsRoute,
    listReads(() => new Response('boom', { status: 500 })),
    (req) => (req.url === '/api/chat/workspaces' && req.method === 'GET' ? json([{ id: 'w1', name: 'Shared hunts', can_manage: true }]) : undefined),
  ]);
  await render({ apiEndpoints: { workspaces: '/chat/workspaces' } });
  assert.ok(listError());
  assert.ok(!text().includes('No conversations yet') && !text().includes('Shared hunts'), text());
});

test("the header's history menu says the list could not be read, and retries it", async () => {
  let answer: () => Response = () => new Response('boom', { status: 500 });
  fakeBackend([agentsRoute, listReads(() => answer())]);
  await render({ hideConversationList: true });
  await click(button('Conversation history'));
  const menuError = () => document.body.querySelector('[data-testid="filigran-chat-conversation-list-error"]');
  assert.ok(menuError());
  assert.ok(!document.body.textContent?.includes('No conversations yet'));
  answer = () => json([{ conversation_id: 'c1', title: 'Found it' }]);
  await click(button('Retry'));
  assert.equal(menuError(), null);
  assert.ok(document.body.textContent?.includes('Found it'));
});
