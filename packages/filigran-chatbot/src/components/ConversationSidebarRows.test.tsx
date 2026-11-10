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

test('a row shows its last message and the messaging channel it was started in, and a row without them shows neither', async () => {
  const { rows, unmount } = await renderSidebar([
    { conversationId: 'c1', title: 'Hunting', lastMessagePreview: 'Found two beacons', channel: 'slack', agentName: 'Hunter' },
    { conversationId: 'c2', title: 'Plain', channel: 'web' },
  ]);
  const [slack, plain] = rows();
  assert.ok(slack.textContent?.includes('Found two beacons'));
  assert.ok(slack.querySelector('[role="img"][aria-label="Started in Slack"]'), 'the channel, named');
  assert.equal(plain.textContent, 'Plain', 'the title alone: no preview line, no channel for the panel’s own');
  assert.equal(plain.querySelector('[role="img"]'), null);
  await unmount();
});

test("the host names a row's channel, or hides it", async () => {
  const { rows, unmount } = await renderSidebar(
    [
      { conversationId: 'c1', title: 'One', channel: 'slack' },
      { conversationId: 'c2', title: 'Two', channel: 'mattermost' },
    ],
    { channelLabel: (channel) => (channel === 'slack' ? null : 'Mattermost') },
  );
  const [one, two] = rows();
  assert.equal(one.querySelector('[role="img"]'), null);
  assert.ok(two.querySelector('[role="img"][aria-label="Started in Mattermost"]'));
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
