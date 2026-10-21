/**
 * Rendering tests of what a host adds to the panel - `yarn test`: marker
 * cards, the text transform, the layout slots, message and row extras, the
 * status line and in-host artifact opening.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { fakeBackend, installDom, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';

installDom();
const { ChatPanel } = await import('./ChatPanel.tsx');
type Props = import('../types.ts').ChatPanelProps;
type Handle = import('../types.ts').ChatPanelHandle;

const AGENTS = [{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null }];

let container: HTMLElement;
let root: Root;

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

const baseProps: Props = {
  mode: 'inline',
  onClose: () => undefined,
  onModeChange: () => undefined,
  apiBaseUrl: '/api',
  user: { firstName: 'Ada' },
};

async function render(props: Partial<Props>, ref?: React.Ref<Handle>) {
  await act(async () => {
    root.render(<ChatPanel {...baseProps} {...props} ref={ref} />);
  });
  await act(async () => settle());
}

const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);
const restoreRoute = (messages: unknown[]) => (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages }) : undefined;
const historyRoute = (req: RecordedRequest) =>
  req.url === '/api/chat/sessions' && req.method === 'GET' ? json([{ conversation_id: 'c1', title: 'Hunting APT28' }]) : undefined;

const text = () => container.textContent ?? '';

test("a host's marker renders its card in place, and one that throws takes only itself down", async () => {
  fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm1', role: 'assistant', content: 'Before [[WORK_ITEM:w1]] middle [[INVESTIGATION:i1]] [[RUNNER:r1]] after [[OTHER:x]]' }]),
  ]);
  const Broken = () => {
    throw new Error('boom');
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    await render({
      conversationId: 'c1',
      markerRenderers: {
        work_item: { render: (args) => <span>Work item {args}</span> },
        INVESTIGATION: { render: () => <Broken /> },
        RUNNER: {
          render: () => {
            throw new Error('unreadable arguments');
          },
        },
      },
    });
  } finally {
    console.error = original;
  }
  assert.ok(text().includes('Work item w1'));
  assert.equal(text().split('This item could not be loaded.').length - 1, 2, 'a card that throws, and a renderer that throws itself');
  assert.ok(text().includes('after [[OTHER:x]]'), 'a marker no renderer names stays text');
  assert.ok(!text().includes('[[WORK_ITEM'));
});

test('the text transform is what is shown', async () => {
  fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'assistant', content: 'Key is [[SECRET_VARIABLE:s1:0123456789abcdef]]' }])]);
  await render({
    conversationId: 'c1',
    transformMessageText: (value) => value.replace(/\[\[SECRET_VARIABLE:[^\]]+\]\]/g, '[secret]'),
  });
  assert.ok(text().includes('Key is [secret]'));
  assert.ok(!text().includes('SECRET_VARIABLE'));
});

test('the layout slots, row and message extras all render', async () => {
  fakeBackend([agentsRoute, historyRoute, restoreRoute([{ id: 'm1', role: 'assistant', content: 'Answer' }])]);
  await render({
    conversationId: 'c1',
    headerActions: <button type="button">Share</button>,
    banner: <div>Continued from Slack</div>,
    composerHeader: <div>Acting on: Laptop-42</div>,
    transcriptFooter: <div>Live investigation</div>,
    renderMessageExtras: (m) => (m.role === 'assistant' ? <div>Ran 3 commands</div> : null),
    messageFooterActions: () => <button type="button">View trace</button>,
    sidebarRowActions: (c) => <button type="button">Pin {c.title}</button>,
    sidebarHeaderActions: <button type="button">Filter</button>,
    sidebarSections: <div>Shared with me</div>,
  });
  for (const expected of [
    'Share',
    'Continued from Slack',
    'Acting on: Laptop-42',
    'Live investigation',
    'Ran 3 commands',
    'View trace',
    'Pin Hunting APT28',
    'Filter',
    'Shared with me',
  ]) {
    assert.ok(text().includes(expected), `missing ${expected}`);
  }
});

test('the welcome slot replaces the welcome screen', async () => {
  fakeBackend([agentsRoute]);
  await render({ welcome: <div>Start an investigation</div> });
  assert.ok(text().includes('Start an investigation'));
  assert.ok(!text().includes('How can'));
});

test('a deck opens in the host, not in a new tab, when the host opens artifacts', async () => {
  fakeBackend([
    agentsRoute,
    restoreRoute([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Here: [[PRESENTATION:d1]]',
        artifacts: [{ kind: 'presentation', id: 'd1', title: 'Q3 threats', url: 'https://xtm.test/presentations/d1', downloads: [] }],
      },
    ]),
  ]);
  const opened: string[] = [];
  await render({ conversationId: 'c1', onArtifactOpen: (a) => opened.push(a.id) });
  assert.equal(container.querySelector('a[href="https://xtm.test/presentations/d1"]'), null);
  const open = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Open')!;
  await act(async () => open.click());
  assert.deepEqual(opened, ['d1']);
});

test("the status line says what the host's label says", async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await act(async () => {
    root.render(
      <ChatPanel
        {...baseProps}
        ref={ref}
        statusLabel={(s) => (s.status === 'tool_start' && s.tools?.[0] === 'run_command' ? 'Running on your machine…' : undefined)}
      />,
    );
    await settle();
  });
  await act(async () => {
    ref.current!.send('go');
    await settle();
    stream.send({ type: 'status', status: 'tool_start', tools: ['run_command'] });
    await settle();
  });
  assert.ok(text().includes('Running on your machine…'));
  await act(async () => {
    stream.close();
    await settle();
  });
});

test('a card that threw while its answer streamed is tried again once the answer is done', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  const original = console.error;
  console.error = () => undefined;
  try {
    await render(
      {
        markerRenderers: {
          WORK_ITEM: {
            renderWhileStreaming: true,
            render: (args, { streaming }) => {
              if (streaming) throw new Error('not ready while streaming');
              return <span>Work item {args}</span>;
            },
          },
        },
      },
      ref,
    );
    await act(async () => {
      void ref.current!.send('go');
      await settle();
    });
    await act(async () => {
      stream.send({ type: 'stream', content: 'See [[WORK_ITEM:w1]]' });
      await settle(10);
    });
    assert.ok(text().includes('This item could not be loaded.'));
    await act(async () => {
      stream.send({ type: 'done', content: 'See [[WORK_ITEM:w1]]', conversation_id: 'c1' });
      stream.close();
      await settle(10);
    });
  } finally {
    console.error = original;
  }
  assert.ok(text().includes('Work item w1'));
  assert.ok(!text().includes('This item could not be loaded.'));
});
