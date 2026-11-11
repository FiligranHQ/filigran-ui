/**
 * Rendering tests of the conversation list's workspaces - `yarn test`.
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';

import { installDom, settle } from '../../test/dom.ts';

installDom();
// After the DOM: react-dom reads at load whether the page fires input events,
// and the search box's typing reaches it only if it does.
const { createRoot } = await import('react-dom/client');
const { ConversationSidebar, inWorkspaceFilter, WORKSPACE_FILTER } = await import('./ConversationSidebar.tsx');
const { setValue } = await import('../utils/pageActions.ts');

const WORKSPACE = { id: 'w1', name: 'Hunts', isOwn: true, isDefault: false, canManage: true };

// These tests read the workspace groups: the Workspaces line starts open, as
// for a user who opened it once. Its default, folded, has its own tests.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('filigran-chat-workspaces-open', '1');
});

type SidebarProps = ComponentProps<typeof ConversationSidebar>;

/**
 * The list's opened groups held as the panel holds them: each change applied
 * to the set open then, and the host told of each one, never of its seed.
 */
function HeldGroups({ initial, report, ...props }: Omit<SidebarProps, 'expandedGroups' | 'onGroupOpenedChange'> & { initial: string[]; report: (keys: string[]) => void }) {
  const [opened, setOpened] = useState(initial);
  const reported = useRef(opened);
  useEffect(() => {
    if (opened === reported.current) return;
    reported.current = opened;
    report(opened);
  }, [opened, report]);
  return (
    <ConversationSidebar
      {...props}
      expandedGroups={opened}
      onGroupOpenedChange={(key, open) =>
        setOpened((prev) => (prev.includes(key) === open ? prev : open ? [...prev, key] : prev.filter((k) => k !== key)))
      }
    />
  );
}

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
  // Rename lives in the row's More menu, which opens from the keyboard.
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('button[aria-label="More actions"]')!
      .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }) as unknown as Event);
    await settle();
  });
  await act(async () => {
    [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent?.trim() === 'Rename conversation')!.click();
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
      <HeldGroups
        conversations={[conversation('c1', 'w1'), conversation('c2', 'w2')]}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        initial={['w2']}
        report={(keys) => reported.push(keys)}
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

test('a group opened while a workspace is being created stays open once it is', async () => {
  const workspace = (id: string, name: string) => ({ id, name, isOwn: true, isDefault: false, canManage: true });
  const conversation = (id: string, workspaceId: string) => ({ conversationId: id, title: `Chat ${id}`, updatedAt: '2026-11-01T00:00:00Z', workspaceId });
  const list = [workspace('w1', 'Hunts'), workspace('w2', 'Reports')];
  const reported: string[][] = [];
  let finishCreate!: () => void;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const draw = () =>
    root.render(
      <HeldGroups
        conversations={[conversation('c1', 'w1'), conversation('c2', 'w2')]}
        loading={false}
        activeConversationId={null}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onDelete={() => undefined}
        onNewChat={() => undefined}
        initial={['w2']}
        report={(keys) => reported.push(keys)}
        workspaces={{
          list,
          pendingWorkspaceId: null,
          // The create answers only once the user has opened Hunts meanwhile.
          onCreate: (name) =>
            new Promise((resolve) => {
              finishCreate = () => {
                const created = workspace('w3', name);
                list.push(created);
                resolve({ ok: true, workspace: created });
              };
            }),
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

  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="New workspace"]')!.click());
  const name = container.querySelector<HTMLInputElement>('input[placeholder="Workspace name"]')!;
  await act(async () => {
    setValue(name, 'Triage');
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
  });
  await act(async () => header('Hunts')!.click());
  await act(async () => {
    finishCreate();
    await settle();
  });
  await act(async () => {
    draw();
    await settle();
  });
  assert.equal(header('Hunts')?.getAttribute('aria-expanded'), 'true', 'the group opened meanwhile collapsed again');
  assert.equal(header('Triage')?.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(reported.at(-1)?.sort(), ['w1', 'w2', 'w3'], 'the host is told the groups open now');

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

async function renderTenWorkspaces(props: Partial<SidebarProps> = {}) {
  const list = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, name: `Workspace ${i}`, isOwn: true, isDefault: i === 0, canManage: true }));
  const conversations = Array.from({ length: 12 }, (_, i) => ({
    conversationId: `c${i}`,
    title: `Chat ${i}`,
    updatedAt: `2026-11-${String(20 - i).padStart(2, '0')}T00:00:00Z`,
    workspaceId: i % 3 === 0 ? `w${i % 10}` : null,
  }));
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
        workspaces={{
          list,
          pendingWorkspaceId: null,
          onCreate: async () => ({ ok: true }),
          onRename: async () => ({ ok: true }),
          onDelete: async () => ({ ok: true }),
          onMove: async () => undefined,
          onNewChat: () => undefined,
        }}
        t={(key) => key}
        {...props}
      />,
    );
    await settle();
  });
  const workspacesLine = () =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.startsWith('Workspaces'));
  const rowTitles = () => [...container.querySelectorAll<HTMLElement>('[role="button"][aria-current]')].map((r) => r.textContent ?? '');
  return { container, workspacesLine, rowTitles, unmount: () => act(() => root.unmount()) };
}

test('conversations come first: ten workspaces fold into one line, and every conversation is listed, most recent first', async () => {
  localStorage.clear();
  const { container, workspacesLine, rowTitles, unmount } = await renderTenWorkspaces();
  assert.equal(workspacesLine()?.getAttribute('aria-expanded'), 'false', 'folded by default');
  assert.ok(workspacesLine()?.textContent?.endsWith('10'), 'the line counts the workspaces');
  const groupHeaders = [...container.querySelectorAll('button[aria-expanded]')].filter((b) => /^Workspace \d/.test(b.textContent ?? ''));
  assert.equal(groupHeaders.length, 0, 'no workspace row takes the list over');
  const rows = rowTitles();
  assert.equal(rows.length, 12, 'filed conversations are listed too');
  assert.ok(rows[0].startsWith('Chat 0'), 'the most recent first');
  assert.ok(rows[1].startsWith('Chat 1'));
  const described = [...container.querySelectorAll('[role="button"][aria-current]')].map((r) => r.getAttribute('aria-description'));
  assert.ok(described[0]?.startsWith('Workspace 0 · '), 'a filed conversation names its workspace, read out after its title');
  assert.equal(described.filter((d) => d?.includes('Workspace')).length, 4, 'an unfiled one names none');
  assert.ok(container.querySelector('button[aria-label="New workspace"]'), 'a workspace can still be created from the folded line');
  await unmount();
});

test('the workspaces leave the top of the list: their folded line comes after every conversation', async () => {
  localStorage.clear();
  const { container, workspacesLine, unmount } = await renderTenWorkspaces();
  const rows = [...container.querySelectorAll('[role="button"][aria-current]')];
  const line = workspacesLine()!;
  assert.ok(rows.length > 0);
  for (const row of rows) assert.ok(row.compareDocumentPosition(line) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'the line follows the conversations');
  assert.equal(container.querySelector('button[aria-label="New conversation outside a workspace"]'), null, 'one New conversation, in the header');
  await unmount();
});

test('the conversation whose answer is being written ends its row with a labelled spinner, the others none', async () => {
  localStorage.clear();
  const { container, unmount } = await renderTenWorkspaces({ generatingConversationId: 'c1' });
  // The design system's labelled Spinner: a status region holding the words read out.
  const spinners = [...container.querySelectorAll('[role="status"]')].filter((s) => s.textContent === 'Writing an answer');
  assert.equal(spinners.length, 1);
  assert.ok(spinners[0].closest('[role="button"][aria-current]')?.textContent?.startsWith('Chat 1'), 'on the generating row');
  await unmount();
});

test('the Workspaces line opens on demand, shows every workspace with its actions, and stays open on the next visit', async () => {
  localStorage.clear();
  const first = await renderTenWorkspaces();
  await act(async () => first.workspacesLine()!.click());
  assert.equal(first.workspacesLine()?.getAttribute('aria-expanded'), 'true');
  for (let i = 0; i < 10; i += 1) assert.ok(first.container.textContent?.includes(`Workspace ${i}`), `Workspace ${i}`);
  assert.ok(first.container.querySelector('button[aria-label="New conversation in this workspace"]'), 'a workspace still starts its own conversation');
  await first.unmount();
  const again = await renderTenWorkspaces();
  assert.equal(again.workspacesLine()?.getAttribute('aria-expanded'), 'true', 'remembered in the browser');
  await act(async () => again.workspacesLine()!.click());
  assert.equal(localStorage.getItem('filigran-chat-workspaces-open'), null, 'folded again: nothing kept');
  await again.unmount();
});

test('a conversation about to start in a workspace shows that workspace, the line folded or not', async () => {
  localStorage.clear();
  const { workspacesLine, container, unmount } = await renderTenWorkspaces({
    workspaces: {
      list: [WORKSPACE],
      pendingWorkspaceId: 'w1',
      onCreate: async () => ({ ok: true }),
      onRename: async () => ({ ok: true }),
      onDelete: async () => ({ ok: true }),
      onMove: async () => undefined,
      onNewChat: () => undefined,
    },
  });
  assert.equal(workspacesLine()?.getAttribute('aria-expanded'), 'true');
  assert.ok(container.textContent?.includes('Hunts'));
  await unmount();
});

test('the header offers one workspace filter: every workspace, the unfiled conversations, or one workspace', async () => {
  localStorage.clear();
  const { container, unmount } = await renderTenWorkspaces();
  const trigger = container.querySelector('[data-testid="filigran-chat-workspace-filter"]');
  assert.ok(trigger, 'the filter sits in the header');
  assert.equal(trigger?.getAttribute('aria-label'), 'Filter by workspace');
  assert.ok(trigger?.textContent?.includes('All workspaces'), 'every workspace by default');
  await unmount();
  const filed = { conversationId: 'a', title: 'Filed', workspaceId: 'w1' };
  const unfiled = { conversationId: 'b', title: 'Unfiled', workspaceId: null };
  assert.ok(inWorkspaceFilter(filed, WORKSPACE_FILTER.all) && inWorkspaceFilter(unfiled, WORKSPACE_FILTER.all));
  assert.ok(!inWorkspaceFilter(filed, WORKSPACE_FILTER.none) && inWorkspaceFilter(unfiled, WORKSPACE_FILTER.none));
  assert.ok(inWorkspaceFilter(filed, 'w1') && !inWorkspaceFilter(filed, 'w2') && !inWorkspaceFilter(unfiled, 'w1'));
});

test('without workspaces the header has no workspace filter', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConversationSidebar
        conversations={[{ conversationId: 'c1', title: 'One' }]}
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
  assert.equal(container.querySelector('[data-testid="filigran-chat-workspace-filter"]'), null);
  await act(async () => root.unmount());
  container.remove();
});
