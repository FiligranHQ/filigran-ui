/**
 * Rendering tests of the conversation list's workspaces - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, useMemo, type ReactNode } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the DOM: react-dom reads at load whether the page fires input events,
// and the search box's typing reaches it only if it does.
const { createRoot } = await import('react-dom/client');
const { ConversationSidebar } = await import('./ConversationSidebar.tsx');
const { setValue } = await import('../utils/pageActions.ts');

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
          onMove: async () => undefined,
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

type Sections = ReactNode | ((search: { query: string }) => ReactNode);

async function renderWithSections(sections: Sections, props: { conversations?: typeof MANY; collapsed?: boolean; workspaces?: boolean } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const draw = (next: Sections, more: { conversations?: typeof MANY; collapsed?: boolean; activeConversationId?: string | null } = {}) =>
    act(async () => {
      root.render(
        <ConversationSidebar
          conversations={more.conversations ?? props.conversations ?? MANY}
          loading={false}
          activeConversationId={more.activeConversationId ?? null}
          collapsed={more.collapsed ?? props.collapsed ?? false}
          onToggleCollapsed={() => undefined}
          onSelect={() => undefined}
          onDelete={() => undefined}
          onNewChat={() => undefined}
          sections={next}
          workspaces={
            props.workspaces
              ? {
                  list: [WORKSPACE],
                  pendingWorkspaceId: null,
                  onCreate: async () => ({ ok: true }),
                  onRename: async () => ({ ok: true }),
                  onDelete: async () => ({ ok: true }),
                  onMove: async () => undefined,
                  onNewChat: () => undefined,
                }
              : undefined
          }
          t={(key) => key}
        />,
      );
      await settle();
    });
  await draw(sections);
  const searchBox = () => container.querySelector<HTMLInputElement>('input[aria-label="Search conversations..."]');
  const search = async (text: string) => {
    const input = searchBox();
    assert.ok(input, 'the search box');
    await act(async () => {
      setValue(input, text);
      await settle();
    });
  };
  return { container, draw, search, searchBox, unmount: () => act(() => root.unmount()) };
}

const sharedSection =
  (titles: string[], calls: string[] = []) =>
  ({ query }: { query: string }) => {
    calls.push(query);
    const shown = titles.filter((title) => title.toLowerCase().includes(query.toLowerCase()));
    return <section aria-label="Shared with me">{shown.join(', ')}</section>;
  };

test("a host's sections given as a function follow the search", async () => {
  const queries: string[] = [];
  const { container, search, unmount } = await renderWithSections(sharedSection(['Acme intrusion', 'Phishing wave'], queries));
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

test("a hook in the host's function itself survives a collapse, as long as it draws one branch", async () => {
  function Shared({ query }: { query: string }) {
    const shown = useMemo(() => ['Acme intrusion'].filter((t) => t.toLowerCase().includes(query.toLowerCase())), [query]);
    return <section aria-label="Shared with me">{shown.join(', ')}</section>;
  }
  const sections = ({ query }: { query: string }) => {
    // The supported place for hooks is `Shared`, a component the function
    // returns; one in the function itself holds while it draws one branch.
    const label = useMemo(() => `Shared (${query || 'all'})`, [query]);
    return (
      <div aria-label={label}>
        <Shared query={query} />
      </div>
    );
  };
  const { container, draw, unmount } = await renderWithSections(sections);
  await draw(sections, { collapsed: true });
  await draw(sections, { collapsed: false });
  assert.equal(container.querySelector('section[aria-label="Shared with me"]')?.textContent, 'Acme intrusion');
  await unmount();
});

test("a host's function is drawn again on a new search, not on the list's own updates", async () => {
  const calls: string[] = [];
  const sections = sharedSection(['Acme intrusion'], calls);
  const { draw, search, unmount } = await renderWithSections(sections);
  const before = calls.length;
  await draw(sections, { activeConversationId: 'c3' });
  assert.equal(calls.length, before, 'another conversation opened: not drawn again');
  await search('acme');
  assert.equal(calls.length, before + 1, 'a new search: drawn again');
  await unmount();
});

test('sections that follow the search offer the box whatever the number of conversations', async () => {
  const few = MANY.slice(0, 2);
  const { searchBox, unmount } = await renderWithSections(sharedSection(['Acme intrusion']), { conversations: few });
  assert.ok(searchBox(), 'offered with two conversations');
  await unmount();
  const plain = await renderWithSections(<section />, { conversations: few });
  assert.equal(plain.searchBox(), null, 'not for sections that do not follow it');
  await plain.unmount();
});

test("with sections that follow the search, no match among the user's own does not claim none at all", async () => {
  for (const workspaces of [false, true]) {
    const { container, search, unmount } = await renderWithSections(sharedSection(['Acme intrusion']), { workspaces });
    await search('acme');
    const layout = workspaces ? 'grouped by workspace' : 'flat';
    assert.ok(container.textContent?.includes('None of your conversations matches'), layout);
    assert.ok(!container.textContent?.includes('No conversation matches'), layout);
    await unmount();
  }
});

test('a search box that hides takes its query with it', async () => {
  const { container, draw, search, unmount } = await renderWithSections(<section />);
  await search('nothing like it');
  assert.ok(container.textContent?.includes('No conversation matches'));
  const seven = MANY.slice(0, 7);
  await draw(<section />, { conversations: seven });
  assert.ok(!container.textContent?.includes('No conversation matches'), 'no hidden filter left');
  assert.ok(container.textContent?.includes('Conversation 6'));
  await draw(<section />);
  assert.equal(container.querySelector<HTMLInputElement>('input[aria-label="Search conversations..."]')?.value, '', 'the box comes back empty');
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

test('Escape while an input method composes does not clear the conversation search', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const conversations = Array.from({ length: 8 }, (_, i) => ({ conversationId: `c${i}`, title: `Conversation ${i}` }));
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
      />,
    );
    await settle();
  });
  const search = container.querySelector<HTMLInputElement>('input[aria-label="Search conversations..."]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(search), 'value')!.set!.call(search, 'とう');
    search.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    await settle();
  });
  const escape = (init: Record<string, unknown>) =>
    act(async () => {
      search.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init }) as unknown as Event);
      await settle();
    });
  await escape({ isComposing: true });
  await escape({ keyCode: 229 });
  assert.equal(search.value, 'とう', 'the composition is cancelled, not the search');
  await escape({});
  assert.equal(search.value, '');
  await act(async () => root.unmount());
  container.remove();
});

test('given the groups a user opened, the others start collapsed, a toggle says which are open, and a workspace created here opens', async () => {
  const workspace = (id: string, name: string) => ({ id, name, isOwn: true, isDefault: false, canManage: true });
  const conversation = (id: string, workspaceId: string) => ({ conversationId: id, title: `Chat ${id}`, updatedAt: '2026-11-01T00:00:00Z', workspaceId });
  const list = [workspace('w1', 'Hunts'), workspace('w2', 'Reports')];
  const reported: string[][] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const draw = () =>
    root.render(
      <ConversationSidebar
        conversations={[conversation('c1', 'w1'), conversation('c2', 'w2')]}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        expandedGroups={['w2']}
        onExpandedGroupsChange={(keys) => reported.push(keys)}
        workspaces={{
          list,
          pendingWorkspaceId: null,
          onCreate: async (name) => {
            const created = workspace('w3', name);
            list.push(created);
            return { ok: true, workspace: created };
          },
          onRename: async () => ({ ok: true }),
          onDelete: async () => ({ ok: true }),
          onMove: async () => undefined,
          onNewChat: () => undefined,
        }}
        t={(key) => key}
      />,
    );
  await act(async () => {
    draw();
    await settle();
  });
  const header = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.includes(name));
  assert.equal(header('Hunts')?.getAttribute('aria-expanded'), 'false', 'a group never opened starts collapsed');
  assert.equal(header('Reports')?.getAttribute('aria-expanded'), 'true', 'a group the user opened starts open');

  await act(async () => header('Hunts')!.click());
  assert.equal(header('Hunts')?.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(reported.at(-1)?.sort(), ['w1', 'w2'], 'the host is told which groups are open');
  await act(async () => header('Reports')!.click());
  assert.deepEqual(reported.at(-1), ['w1']);

  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="New workspace"]')!.click());
  const name = container.querySelector<HTMLInputElement>('input[placeholder="Workspace name"]');
  assert.ok(name, 'the name field');
  await act(async () => {
    setValue(name, 'Triage');
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
  });
  await act(async () => {
    draw();
    await settle();
  });
  assert.equal(header('Triage')?.getAttribute('aria-expanded'), 'true', 'a workspace the user creates opens');
  assert.deepEqual(reported.at(-1)?.sort(), ['w1', 'w3']);

  await act(async () => root.unmount());
  container.remove();
});

test('the groups a user opened, given once the list has mounted, apply then', async () => {
  const workspace = (id: string, name: string) => ({ id, name, isOwn: true, isDefault: false, canManage: true });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const draw = (expandedGroups: string[] | undefined) =>
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
        expandedGroups={expandedGroups}
        workspaces={{
          list: [workspace('w1', 'Hunts'), workspace('w2', 'Reports')],
          pendingWorkspaceId: null,
          onCreate: async () => ({ ok: true }),
          onRename: async () => ({ ok: true }),
          onDelete: async () => ({ ok: true }),
          onMove: async () => undefined,
          onNewChat: () => undefined,
        }}
        t={(key) => key}
      />,
    );
  const header = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.includes(name));
  await act(async () => {
    draw(undefined);
    await settle();
  });
  await act(async () => {
    draw(['w2']);
    await settle();
  });
  assert.equal(header('Hunts')?.getAttribute('aria-expanded'), 'false');
  assert.equal(header('Reports')?.getAttribute('aria-expanded'), 'true');
  await act(async () => root.unmount());
  container.remove();
});
