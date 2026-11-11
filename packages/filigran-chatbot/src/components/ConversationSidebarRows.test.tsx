/**
 * Rendering tests of the conversation list's rows and search - `yarn test`.
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';
import type { ChatConversationSummary } from '../types.ts';

installDom();
// After the page: react-dom reads at load whether it fires input events.
const { createRoot } = await import('react-dom/client');
const { ConversationSidebar } = await import('./ConversationSidebar.tsx');
const { TOOLTIP_OPEN_DELAY_MS } = await import('../utils/tooltipPlacement.ts');

// A hover opens the tooltip after the design system's delay.
const pastTheDelay = () => new Promise((resolve) => setTimeout(resolve, TOOLTIP_OPEN_DELAY_MS + 50));

type SidebarProps = Parameters<typeof ConversationSidebar>[0];

// The workspace actions are read with the Workspaces line open, as for a user who opened it once.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('filigran-chat-workspaces-open', '1');
});

async function renderSidebar(conversations: ChatConversationSummary[], props: Partial<SidebarProps> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConversationSidebar
        conversations={conversations}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        t={(key) => key}
        {...props}
      />,
    );
    await settle();
  });
  const rows = () => [...container.querySelectorAll<HTMLElement>('[role="button"][aria-current]')];
  const search = () => container.querySelector<HTMLInputElement>('input[aria-label="Search conversations..."]');
  const type = async (value: string) => {
    const input = search()!;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    await act(async () => {
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
    });
  };
  return {
    container,
    rows,
    search,
    type,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

/** The title span of *row*. */
const titleOf = (row: HTMLElement, text: string) => [...row.querySelectorAll<HTMLElement>('span')].find((s) => s.textContent === text && !s.children.length)!;

/** The tooltip *el* opens on hover, `null` for none. */
async function hoverTip(container: HTMLElement, el: HTMLElement) {
  await act(async () => {
    el.parentElement!.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
    await pastTheDelay();
    await settle();
  });
  const text = container.ownerDocument.querySelector('[role="tooltip"]')?.textContent ?? null;
  await act(async () => {
    el.parentElement!.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true }));
    await settle();
  });
  return text;
}

test('a row is one line: its title, the agent, the channel and the time said in its tooltip', async () => {
  const updatedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { container, rows, unmount } = await renderSidebar([
    { conversationId: 'c1', title: 'Hunting', lastMessagePreview: 'Found two beacons', channel: 'slack', agentName: 'Hunter', updatedAt },
    { conversationId: 'c2', title: 'Plain', channel: 'web' },
  ]);
  const [slack, plain] = rows();
  assert.equal(slack.textContent, 'Hunting', 'no preview line, no agent pill, no time on the row');
  assert.equal(slack.querySelector('[data-agent-pill]'), null);
  assert.equal(await hoverTip(container, titleOf(slack, 'Hunting')), 'Hunting\nHunter · Started in Slack · 3d ago');
  assert.equal(plain.textContent, 'Plain');
  await unmount();
});

test('a row without a title shows the first words of its conversation', async () => {
  const { rows, unmount } = await renderSidebar([{ conversationId: 'c1', title: '', lastMessagePreview: 'Which hosts beaconed to the C2 last night?' }]);
  assert.equal(rows()[0].textContent, 'Which hosts beaconed to the C2 last night?');
  await unmount();
});

test("a list of several agents shows each row's agent icon, a list of one agent shows none", async () => {
  const several = await renderSidebar([
    { conversationId: 'c1', title: 'Hunting', agentName: 'Hunter', agentIcon: 'https://example.test/hunter.png' },
    { conversationId: 'c2', title: 'Triage', agentName: 'Analyst', agentIcon: '🛰️' },
    { conversationId: 'c3', title: 'Legacy', agentName: 'Retired', agentIcon: 'lucide:bot' },
  ]);
  const [image, emoji, legacy] = several.rows();
  assert.equal(image.querySelector('img[data-agent-icon="image"]')?.getAttribute('src'), 'https://example.test/hunter.png');
  assert.equal(emoji.querySelector('[data-agent-icon="emoji"]')?.textContent, '🛰️');
  assert.equal(legacy.querySelector('[data-agent-icon]'), null, 'an icon the panel cannot draw keeps the bot glyph');
  assert.ok(legacy.querySelector('svg'));
  await several.unmount();

  const one = await renderSidebar([
    { conversationId: 'c1', title: 'Hunting', agentName: 'Hunter', agentIcon: 'https://example.test/hunter.png' },
    { conversationId: 'c2', title: 'Triage', agentName: 'Hunter', agentIcon: 'https://example.test/hunter.png' },
  ]);
  assert.equal(one.rows()[0].querySelector('[data-agent-icon]'), null, 'filtered to one agent: no per-row icon');
  await one.unmount();
});

test('the list is cut into date groups under sticky headers, most recent first', async () => {
  const { container, rows, unmount } = await renderSidebar([
    { conversationId: 'c1', title: 'Now', updatedAt: new Date().toISOString() },
    { conversationId: 'c2', title: 'Old', updatedAt: '2020-03-05T09:00:00Z' },
  ]);
  const groups = [...container.querySelectorAll<HTMLElement>('[role="group"]')].map((g) => g.getAttribute('aria-label'));
  assert.equal(groups[0], 'Today');
  assert.ok(groups[1]?.includes('2020'), groups[1] ?? '');
  assert.deepEqual(
    rows().map((r) => r.textContent),
    ['Now', 'Old'],
  );
  await unmount();
});

test('a loading list shows 32 px skeleton rows, marked busy', async () => {
  const { container, unmount } = await renderSidebar([], { loading: true });
  const loading = container.querySelector<HTMLElement>('[data-testid="filigran-chat-list-loading"]');
  assert.ok(loading);
  assert.equal(loading.getAttribute('aria-busy'), 'true');
  assert.equal(loading.querySelectorAll('.h-8').length, 6);
  await unmount();
});

test("a row draws a named agent icon through the host's renderAgentIcon, and keeps the bot glyph when the host has none", async () => {
  const { AgentIconRendererProvider } = await import('./AgentIconGlyph.tsx');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const asked: [string, number][] = [];
  await act(async () => {
    root.render(
      <AgentIconRendererProvider
        value={(name, { size }) => {
          asked.push([name, size]);
          return name === 'unknown' ? null : <svg data-host-icon={name} width={size} height={size} />;
        }}
      >
        <ConversationSidebar
          conversations={[
            { conversationId: 'c1', title: 'Hunting', agentName: 'Hunter', agentIcon: 'brain-circuit' },
            { conversationId: 'c2', title: 'Scan', agentName: 'Scanner', agentIcon: 'scan-eye' },
            { conversationId: 'c3', title: 'Other', agentName: 'Other', agentIcon: 'unknown' },
          ]}
          loading={false}
          activeConversationId={null}
          collapsed={false}
          onToggleCollapsed={() => undefined}
          onSelect={() => undefined}
          onDelete={() => undefined}
          onNewChat={() => undefined}
          t={(key) => key}
        />
      </AgentIconRendererProvider>,
    );
    await settle();
  });
  const [brain, scan, unknown] = [...container.querySelectorAll<HTMLElement>('[role="button"][aria-current]')];
  assert.equal(brain.querySelector('[data-agent-icon="named"] svg')?.getAttribute('data-host-icon'), 'brain-circuit');
  assert.equal(scan.querySelector('[data-agent-icon="named"] svg')?.getAttribute('data-host-icon'), 'scan-eye');
  assert.equal(unknown.querySelector('[data-agent-icon]'), null, 'the host has no such icon: the bot glyph');
  assert.ok(unknown.querySelector('svg'));
  assert.ok(asked.some(([name, size]) => name === 'brain-circuit' && size === 14));
  await act(async () => root.unmount());
  container.remove();
});

test('a filed conversation names its workspace in its row tooltip, never as a second line', async () => {
  // The Workspaces line folded (its default): filed conversations are listed with the others.
  localStorage.clear();
  const name = 'Threat hunting for the European fleet';
  const { container, rows, unmount } = await renderSidebar(
    [{ conversationId: 'c1', title: 'Hunting', agentName: 'Hunter', workspaceId: 'w1' }],
    {
      workspaces: {
        list: [{ id: 'w1', name, isOwn: true, isDefault: false, canManage: true }],
        pendingWorkspaceId: null,
        onCreate: async () => ({ ok: true }),
        onRename: async () => ({ ok: true }),
        onDelete: async () => ({ ok: true }),
        onMove: async () => undefined,
        onNewChat: () => undefined,
      },
    },
  );
  const [row] = rows();
  assert.ok(!row.textContent?.includes(name), 'one line: the title alone');
  assert.equal(row.querySelector('[data-testid="filigran-chat-row-workspace"]'), null);
  assert.equal(await hoverTip(container, titleOf(row, 'Hunting')), `Hunting\nHunter · ${name}`);
  await unmount();
});

test('a row with nothing more to say opens no tooltip while its title shows whole, and the whole title once cut', async () => {
  const { container, rows, unmount } = await renderSidebar([{ conversationId: 'c1', title: 'Hunting the APT28 beacons across the fleet' }]);
  const [row] = rows();
  const title = titleOf(row, 'Hunting the APT28 beacons across the fleet');
  assert.equal(await hoverTip(container, title), null, 'shown whole: nothing to add');
  Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 200 });
  Object.defineProperty(title, 'clientWidth', { configurable: true, value: 68 });
  assert.equal(await hoverTip(container, title), 'Hunting the APT28 beacons across the fleet');
  await unmount();
});

test("the host names a row's channel in its tooltip, or hides it", async () => {
  const { container, rows, unmount } = await renderSidebar(
    [
      { conversationId: 'c1', title: 'One', channel: 'slack' },
      { conversationId: 'c2', title: 'Two', channel: 'mattermost' },
    ],
    { channelLabel: (channel) => (channel === 'slack' ? null : 'Mattermost') },
  );
  const [one, two] = rows();
  assert.equal(await hoverTip(container, titleOf(one, 'One')), null);
  assert.equal(await hoverTip(container, titleOf(two, 'Two')), 'Two\nStarted in Mattermost');
  await unmount();
});

test('the search box shows above the threshold, the host choosing it', async () => {
  const three: ChatConversationSummary[] = ['a', 'b', 'c'].map((id) => ({ conversationId: id, title: id }));
  const byDefault = await renderSidebar(three);
  assert.equal(byDefault.search(), null, 'three conversations are quicker to scan');
  await byDefault.unmount();
  const always = await renderSidebar(three, { searchThreshold: 0 });
  assert.ok(always.search());
  await always.unmount();
});

test('a search matches the last message and the agent too', async () => {
  const { rows, type, unmount } = await renderSidebar(
    [
      { conversationId: 'c1', title: 'Monday', lastMessagePreview: 'APT28 infrastructure' },
      { conversationId: 'c2', title: 'Tuesday', agentName: 'Phishing triage' },
      { conversationId: 'c3', title: 'Wednesday' },
    ],
    { searchThreshold: 0 },
  );
  await type('apt28');
  assert.deepEqual(
    rows().map((r) => r.textContent?.slice(0, 6)),
    ['Monday'],
  );
  await type('phishing');
  assert.deepEqual(
    rows().map((r) => r.textContent?.slice(0, 7)),
    ['Tuesday'],
  );
  await unmount();
});

test("a failed workspace action is said through the panel's notice, the list keeping none of its own", async () => {
  const said: string[] = [];
  const { container, unmount } = await renderSidebar([], {
    onNotice: (text) => void said.push(text),
    workspaces: {
      list: [{ id: 'w1', name: 'Hunts', isOwn: true, isDefault: false, canManage: true }],
      pendingWorkspaceId: null,
      onCreate: async () => ({ ok: true }),
      onRename: async () => ({ ok: true }),
      onDelete: async () => ({ ok: false, error: 'The workspace is in use' }),
      onMove: async () => undefined,
      onNewChat: () => undefined,
    },
  });
  for (let i = 0; i < 2; i += 1) {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Delete workspace"]')!.click();
      await settle();
    });
  }
  assert.deepEqual(said, ['The workspace is in use']);
  assert.equal(container.querySelector('[role="alert"]'), null, 'shown where the panel puts its notice');
  await unmount();
});

test('the panel says what failed under the list', async () => {
  const { container, unmount } = await renderSidebar([{ conversationId: 'c1', title: 'One' }], { notice: 'The conversation could not be deleted' });
  assert.equal(container.querySelector('[role="alert"]')?.textContent, 'The conversation could not be deleted');
  await unmount();
});
