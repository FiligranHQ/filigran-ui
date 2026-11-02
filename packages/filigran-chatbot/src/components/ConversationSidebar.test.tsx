/**
 * Rendering tests of the conversation list - `yarn test`: its workspaces, and
 * renaming a conversation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// Loaded after the page: react-dom decides at load which events it listens to.
const { createRoot } = await import('react-dom/client');
const { ConversationSidebar } = await import('./ConversationSidebar.tsx');

const WORKSPACE = { id: 'w1', name: 'Hunts', isOwn: true, isDefault: false, canManage: true };

async function renderEmptyWorkspace(t: (key: string) => string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConversationSidebar
        conversations={[]}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        workspaces={{
          list: [WORKSPACE],
          pendingWorkspaceId: null,
          onCreate: async () => ({ ok: true }),
          onRename: async () => ({ ok: true }),
          onDelete: async () => ({ ok: true }),
          onMove: async () => null,
          onNewChat: () => undefined,
        }}
        t={t}
      />,
    );
    await settle();
  });
  const hint = [...container.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Drop') || p.textContent?.startsWith('Déposez'));
  return { container, hint, unmount: () => act(() => root.unmount()) };
}

test("an empty workspace's hint shows the glyph of its New conversation button, not a +", async () => {
  const { container, hint, unmount } = await renderEmptyWorkspace((key) => key);
  assert.ok(hint, 'the hint is shown');
  assert.equal(hint.textContent, 'Drop a conversation here, or start one with .');
  assert.equal(hint.querySelectorAll('svg').length, 1, 'the glyph, in place of {icon}');
  const button = container.querySelector('button[aria-label="New conversation in this workspace"]');
  assert.ok(button, "the workspace's New conversation button");
  assert.equal(hint.querySelector('svg')?.innerHTML, button.querySelector('svg')?.innerHTML, 'the same glyph as the button');
  const glyph = hint.querySelector('[role="img"]');
  assert.equal(glyph?.getAttribute('aria-label'), 'New conversation in this workspace', 'the glyph is named as the button it stands for');
  await unmount();
});

test("a host's translation keeps the glyph where it puts {icon}", async () => {
  const { hint, unmount } = await renderEmptyWorkspace((key) =>
    key === 'Drop a conversation here, or start one with {icon}.' ? 'Déposez une conversation ici ou démarrez-en une avec {icon}.' : key,
  );
  assert.ok(hint);
  assert.equal(hint.textContent, 'Déposez une conversation ici ou démarrez-en une avec .');
  assert.equal(hint.querySelectorAll('svg').length, 1);
  await unmount();
});

test('Enter while an input method composes does not commit a rename', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const renamed: [string, string][] = [];
  await act(async () => {
    root.render(
      <ConversationSidebar
        conversations={[{ conversationId: 'c1', title: 'Old title' }]}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onRename={(id, title) => renamed.push([id, title])}
        onNewChat={() => undefined}
        t={(key) => key}
      />,
    );
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Rename conversation"]')!.click();
    await settle();
  });
  const field = () => container.querySelector<HTMLInputElement>('input[aria-label="Conversation title"]');
  await act(async () => {
    const input = field()!;
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, '東京');
    input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    await settle();
  });
  const enter = (init: Record<string, unknown>) =>
    act(async () => {
      field()!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }) as unknown as Event);
      await settle();
    });
  await enter({ isComposing: true });
  await enter({ keyCode: 229 });
  assert.deepEqual(renamed, [], 'the composition is confirmed, not the rename');
  assert.equal(field()?.value, '東京', 'the field stays open');
  await enter({ keyCode: 13 });
  assert.deepEqual(renamed, [['c1', '東京']]);
  await act(async () => root.unmount());
  container.remove();
});
