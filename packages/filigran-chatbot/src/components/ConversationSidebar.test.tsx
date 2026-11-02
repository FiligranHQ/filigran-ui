/**
 * Rendering tests of the conversation list's workspaces - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, type ReactNode } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the DOM: react-dom reads at load whether the page fires input events,
// and the search box's typing reaches it only if it does.
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

/** Enough conversations for the list to offer its search box. */
const MANY = Array.from({ length: 8 }, (_, i) => ({ conversationId: `c${i}`, title: `Conversation ${i}` }));

async function renderWithSections(sections: ReactNode | ((search: { query: string }) => ReactNode)) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConversationSidebar
        conversations={MANY}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        sections={sections}
        t={(key) => key}
      />,
    );
    await settle();
  });
  const search = async (text: string) => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search conversations..."]');
    assert.ok(input, 'the search box');
    await act(async () => {
      // The prototype's setter, past the value tracker React puts on the element.
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
    });
  };
  return { container, search, unmount: () => act(() => root.unmount()) };
}

test("a host's sections given as a function follow the search", async () => {
  const queries: string[] = [];
  const shared = ['Acme intrusion', 'Phishing wave'];
  const { container, search, unmount } = await renderWithSections(({ query }) => {
    queries.push(query);
    const shown = shared.filter((title) => title.toLowerCase().includes(query.toLowerCase()));
    return <section aria-label="Shared with me">{shown.join(', ')}</section>;
  });
  const section = () => container.querySelector('section[aria-label="Shared with me"]')?.textContent;
  assert.equal(section(), 'Acme intrusion, Phishing wave', 'everything, with nothing typed');
  assert.equal(queries.at(-1), '');
  await search('  acme ');
  assert.equal(queries.at(-1), 'acme', 'the query as typed, trimmed');
  assert.equal(section(), 'Acme intrusion');
  await search('');
  assert.equal(section(), 'Acme intrusion, Phishing wave');
  await unmount();
});

test("a host's sections given as an element show as they are, whatever is typed", async () => {
  const { container, search, unmount } = await renderWithSections(<section aria-label="Shared with me">Acme intrusion</section>);
  await search('phishing');
  assert.equal(container.querySelector('section[aria-label="Shared with me"]')?.textContent, 'Acme intrusion');
  await unmount();
});

